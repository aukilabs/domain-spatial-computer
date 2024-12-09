import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { fetchDomainDataByNameAndType } from "../../utils/domain/fetchDomainData.ts";
import { ParseOBJString } from "../../utils/parse/objParser.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { FlatPose, Pose } from "../../types/mathTypes.ts";
import { SetGeometryFromOBJ } from "../../utils/math/geometry.ts";

const raycast = async (ctx: Context): Promise<void> => {
  console.log("start raycast");

  try {
    //parse the request body
    const body: DomainRequestBody & {
      ray?: Pose | FlatPose | number[] | number[][];
    } = await ctx.request.body.json();
    const { domainServerUrl, domainId, ray } = body;

    //get auth header
    const authorization = ctx.request.headers.get("Authorization");

    //input guards
    try {
      //ensure we have all required body parameters
      if (!domainServerUrl) throw new Error("Missing domain server url");
      if (!domainId) throw new Error("Missing domain id");
      if (!ray) throw new Error("Missing refinement id");
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

    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, 1);
    if (ray instanceof Array) {
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const flatRay = ray.flat();
      const _matrix = new THREE.Matrix4()
        .fromArray(flatRay)
        .transpose()
        .decompose(origin, rotation, scale);

      direction.applyQuaternion(rotation).normalize();
    } else if ("position" in ray) {
      origin.copy(ray.position);
      direction.applyQuaternion(ray.rotation).normalize();
    } else {
      origin.set(ray.px, ray.py, ray.pz);
      direction
        .applyQuaternion(new THREE.Quaternion(ray.rx, ray.ry, ray.rz, ray.rw))
        .normalize();
    }

    console.log("origin", origin);
    console.log("direction", direction);
    const raycaster = new THREE.Raycaster();
    raycaster.set(origin, direction);

    const occlusionBoxes = occlusion_obj.map((obj) => {
      const obj3d = new THREE.Mesh();
      obj3d.name = obj.name;
      obj3d.geometry = new THREE.BufferGeometry();
      obj3d.material = new THREE.MeshBasicMaterial();
      SetGeometryFromOBJ(obj, obj3d.geometry);
      return obj3d;
    });

    console.log("loaded occlusion boxes #", occlusionBoxes.length);

    const result = raycaster.intersectObjects(occlusionBoxes, true);

    const filteredResult = result.map((hit) => {
      const { point, distance, face, faceIndex, object } = hit;

      return {
        point,
        distance,
        normal: face?.normal,
        faceIndex,
        name: object.name,
      };
    });

    console.log("hits", filteredResult);

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Success",
      data: { hits: filteredResult },
    };

    occlusionBoxes.forEach((x) => x.geometry.dispose());
  } catch (error) {
    console.log(error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Something went wrong.",
      //@ts-expect-error check for .message on unknown
      error: error.message ?? error,
    };
  }
};

export default raycast;
