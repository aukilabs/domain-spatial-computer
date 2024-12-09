import { Context } from "jsr:@oak/oak/context";
import { fetchDomainDataByNameAndType } from "../../utils/domain/fetchDomainData.ts";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { ParseOBJString } from "../../utils/parse/objParser.ts";
import { SetGeometryFromOBJ } from "../../utils/math/geometry.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { init, NavMeshQuery } from "npm:@recast-navigation/core";
import { threeToSoloNavMesh } from "npm:@recast-navigation/three";

type PathfindingRequest = {
  wayPoints?: { x: number; y: number; z: number }[];
  radius?: number;
};

const pathFind = async (ctx: Context): Promise<void> => {
  //parse the request body
  const body: DomainRequestBody & PathfindingRequest =
    await ctx.request.body.json();
  const { domainServerUrl, domainId, wayPoints, radius } = body;
  //get auth header
  const authorization = ctx.request.headers.get("Authorization");
  //input guards
  try {
    //ensure we have all required body parameters
    if (!domainServerUrl) throw new Error("Missing domain server url");
    if (!domainId) throw new Error("Missing domain id");
    if (!wayPoints) throw new Error("Missing waypoints");
    if (!radius) throw new Error("Missing radius");
    if (wayPoints.length < 2) throw new Error("Not enough waypoints");
    //ensure we have an auth token
    if (!authorization) throw new Error("Missing authorization");
  } catch (error) {
    ctx.response.status = 400;
    //@ts-expect-error check for .message on unknown
    ctx.response.body = { message: error.message ?? error };
    return;
  }

  //const recastJS = await recast.default();
  //const rjs = recastJS;

  let navmesh_obj;
  try {
    const navmeshFile = await fetchDomainDataByNameAndType({
      domainServerUrl,
      domainId,
      authorization,
      dataName: "navmesh_v1",
      dataType: "obj",
    });

    navmesh_obj = ParseOBJString(navmeshFile.data);
  } catch (error) {
    //@ts-expect-error unknown error type
    ctx.response.body = { message: error.message };
    ctx.response.status = 500;
    return;
  }

  const navmeshQuads = navmesh_obj.map((obj) => {
    const obj3d = new THREE.Mesh();
    obj3d.name = obj.name;
    obj3d.geometry = new THREE.BufferGeometry();
    obj3d.material = new THREE.MeshBasicMaterial();
    SetGeometryFromOBJ(obj, obj3d.geometry);
    return obj3d;
  });

  await init();

  console.log("radius", radius);
  const { success, navMesh } = threeToSoloNavMesh(navmeshQuads, {
    walkableRadius: radius,
  });

  if (!success || !navMesh) {
    ctx.response.body = { message: "failed to generate" };
    ctx.response.status = 500;
    return;
  }
  const query = new NavMeshQuery(navMesh);

  const path: THREE.Vector3Like[] = [];
  const paths: THREE.Vector3Like[][] = [];

  for (let i = 0; i < wayPoints.length - 1; i++) {
    const pathResult = query.computePath(wayPoints[i], wayPoints[i + 1]);
    if (pathResult.success) {
      if (i == 0) path.push(...pathResult.path);
      else path.push(...pathResult.path.slice(1));
      paths.push(pathResult.path);
    }
  }

  console.log(path);

  ctx.response.body = { full: path, segments: paths };
};

export default pathFind;
