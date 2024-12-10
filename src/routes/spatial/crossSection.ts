import { Context } from "jsr:@oak/oak/context";
import { fetchDomainDataByNameAndType } from "../../utils/domain/fetchDomainData.ts";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { ParseOBJString } from "../../utils/parse/objParser.ts";
import { SetGeometryFromOBJ } from "../../utils/math/geometry.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import * as BufferGeometryUtils from "npm:three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshBVH } from "npm:three-mesh-bvh";
import { PNGImage } from "jsr:@ilawy/dpng";

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
    BufferGeometryUtils.mergeGeometries(occlusionGeometries);

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

  //outlineLines.geometry.setDrawRange(0, index);

  outlineLines.geometry.computeBoundingBox();
  const bounds = outlineLines.geometry.boundingBox;

  const pixelSize = 0.005; //1 pixel per 5mm
  const size = new THREE.Vector3().subVectors(bounds!.max, bounds!.min);
  const offset = new THREE.Vector2(bounds!.min.x, bounds!.min.z);
  const pngSize = new THREE.Vector2(
    Math.ceil(size.x / pixelSize),
    Math.ceil(size.z / pixelSize)
  );

  const png = new PNGImage(pngSize.x, pngSize.y, 10, {
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  });

  for (let i = 0; i < index; i += 2) {
    const pos3d = new THREE.Vector2(posAttr.getX(i), posAttr.getZ(i));
    const pos3d2 = new THREE.Vector2(posAttr.getX(i + 1), posAttr.getZ(i + 1));

    console.log(pos3d, pos3d2);
    drawline(
      new THREE.Vector2(pos3d.x, pos3d.y),
      new THREE.Vector2(pos3d2.x, pos3d2.y),
      offset,
      pixelSize,
      png
    );
  }

  console.log("size", size);
  console.log("pngSize", pngSize);

  const yamlLines = [
    "free_thresh: 0.196",
    "negate:0",
    "occupied_thresh:0.65",
    "image: map.png",
    "origin:",
    `- ${offset.x.toFixed(2)}`,
    `- ${offset.y.toFixed(2)}`,
    "0",
    `resolution: ${pixelSize.toString()}`,
  ];

  const yamlString = yamlLines.join("\n");

  const formData = new FormData();
  formData.append("png", png.getBase64(), "map.png");
  formData.append("yaml", yamlString, "map.yaml");

  ctx.response.body = formData;
  ctx.response.status = 200;
};

function drawline(
  start: THREE.Vector2,
  end: THREE.Vector2,
  offset: THREE.Vector2,
  pixelSize: number,
  png: PNGImage
) {
  const distance = start.distanceTo(end);
  if (distance == 0) return;
  //offset.divideScalar(pixelSize);
  //console.log("offset", offset);
  //console.log("start", start, end);
  const startOffset = start.add(offset).divideScalar(pixelSize);
  const endOffset = end.add(offset).divideScalar(pixelSize);

  const color = png.createRGBColor({ r: 0, g: 0, b: 0, a: 1 });
  //console.log("draw line ", startOffset, endOffset);
  console.log("distance", distance);
  for (let i = 0; i < distance; i += 0.1) {
    const point = startOffset.lerp(endOffset, i / distance);
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    //console.log("point", x, y);
    png.setPixel(x, y, color);
  }
}

export default crossSection;
