import { Context } from "jsr:@oak/oak/context";
import { fetchDomainDataByNameAndType } from "../../utils/domain/fetchDomainData.ts";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { ParseOBJString } from "../../utils/parse/objParser.ts";
import { SetGeometryFromOBJ } from "../../utils/math/geometry.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import * as BufferGeometryUtils from "npm:three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBVH, MeshBVHHelper, CONTAINED } from "npm:three-mesh-bvh";

type CrossSectionRequest = {};

const crossSection = async (ctx: Context): Promise<void> => {
  //parse the request body
  const body: DomainRequestBody & CrossSectionRequest =
    await ctx.request.body.json();
  const { domainServerUrl, domainId } = body;
  //get auth header
  const authorization = ctx.request.headers.get("Authorization");
  //input guards
  try {
    //ensure we have all required body parameters
    if (!domainServerUrl) throw new Error("Missing domain server url");
    if (!domainId) throw new Error("Missing domain id");
    //ensure we have an auth token
    if (!authorization) throw new Error("Missing authorization");
  } catch (error) {
    ctx.response.status = 400;
    //@ts-expect-error check for .message on unknown
    ctx.response.body = { message: error.message ?? error };
    return;
  }

  //call the domain data endpoint to get the refinement manifest
  let occlusion_obj;
  try {
    const occlusionResponse = await fetchDomainDataByNameAndType({
      domainServerUrl,
      domainId,
      authorization,
      dataName: "occlusionmesh_v1",
      dataType: "obj",
    });

    //parse the refinement
    occlusion_obj = ParseOBJString(occlusionResponse.data);
  } catch (error) {
    //@ts-expect-error unknown error type
    ctx.response.body = { message: error.message };
    ctx.response.status = 500;
    return;
  }

  const occlusionGeometries = occlusion_obj.map((obj) => {
    const geo = new THREE.BufferGeometry();
    SetGeometryFromOBJ(obj, geo);
    return geo;
  });

  const mergedGeometry =
    BufferGeometryUtils.mergeBufferGeometries(occlusionGeometries);

  const colliderBvh = new MeshBVH(mergedGeometry, { maxLeafTris: 3 });
  mergedGeometry.boundsTree = colliderBvh;

  const colliderMesh = new THREE.Mesh(
    mergedGeometry,
    new THREE.MeshBasicMaterial({
      wireframe: true,
      transparent: true,
      opacity: 0.01,
      depthWrite: false,
    })
  );

  const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const inverseMatrix = new THREE.Matrix4();
  const localPlane = new THREE.Plane();

  // get the clipping plane in the local space of the BVH
  inverseMatrix.copy(colliderMesh.matrixWorld).invert();
  localPlane.copy(clippingPlane).applyMatrix4(inverseMatrix);

  const tempLine = new THREE.Line3();
  const tempVector = new THREE.Vector3();
  const tempVector1 = new THREE.Vector3();
  const tempVector2 = new THREE.Vector3();
  const tempVector3 = new THREE.Vector3();
  // create line geometry with enough data to hold 100000 segments
  const lineGeometry = new THREE.BufferGeometry();
  const linePosAttr = new THREE.BufferAttribute(
    new Float32Array(300000),
    3,
    false
  );
  linePosAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setAttribute("position", linePosAttr);

  const outlineLines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial()
  );
  outlineLines.material.color.set(0x00acc1);
  outlineLines.frustumCulled = false;
  outlineLines.renderOrder = 3;

  let index = 0;
  const posAttr = outlineLines.geometry.attributes.position;

  colliderBvh.shapecast({
    intersectsBounds: (box) => {
      return localPlane.intersectsBox(box);
    },

    intersectsTriangle: (tri) => {
      // check each triangle edge to see if it intersects with the plane. If so then
      // add it to the list of segments.
      let count = 0;

      //@ts-expect-error ExtendedTriangle extends triangle
      tempLine.start.copy(tri.a);
      //@ts-expect-error ExtendedTriangle extends triangle
      tempLine.end.copy(tri.b);
      if (localPlane.intersectLine(tempLine, tempVector)) {
        posAttr.setXYZ(index, tempVector.x, tempVector.y, tempVector.z);
        index++;
        count++;
      }
      //@ts-expect-error ExtendedTriangle extends triangle
      tempLine.start.copy(tri.b);
      //@ts-expect-error ExtendedTriangle extends triangle
      tempLine.end.copy(tri.c);
      if (localPlane.intersectLine(tempLine, tempVector)) {
        posAttr.setXYZ(index, tempVector.x, tempVector.y, tempVector.z);
        count++;
        index++;
      }

      //@ts-expect-error ExtendedTriangle extends triangle
      tempLine.start.copy(tri.c);
      //@ts-expect-error ExtendedTriangle extends triangle
      tempLine.end.copy(tri.a);
      if (localPlane.intersectLine(tempLine, tempVector)) {
        posAttr.setXYZ(index, tempVector.x, tempVector.y, tempVector.z);
        count++;
        index++;
      }

      // When the plane passes through a vertex and one of the edges of the triangle, there will be three intersections, two of which must be repeated
      if (count === 3) {
        tempVector1.fromBufferAttribute(posAttr, index - 3);
        tempVector2.fromBufferAttribute(posAttr, index - 2);
        tempVector3.fromBufferAttribute(posAttr, index - 1);
        // If the last point is a duplicate intersection
        if (
          tempVector3.equals(tempVector1) ||
          tempVector3.equals(tempVector2)
        ) {
          count--;
          index--;
        } else if (tempVector1.equals(tempVector2)) {
          // If the last point is not a duplicate intersection
          // Set the penultimate point as a distinct point and delete the last point
          posAttr.setXYZ(
            index - 2,
            tempVector3.x,
            tempVector3.y,
            tempVector3.z
          );
          count--;
          index--;
        }
      }

      // If we only intersected with one or three sides then just remove it. This could be handled
      // more gracefully.
      if (count !== 2) {
        index -= count;
      }
    },
  });

  ctx.response.body = `outlines length: ${index}`;
  ctx.response.status = 200;
};

export default crossSection;
