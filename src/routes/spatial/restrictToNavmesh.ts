import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { NavMeshQuery } from "npm:@recast-navigation/core";
import { loadNavmesh } from "../../utils/recast/navmesh.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { EnterDomain } from "../../utils/domain/enterDomain.ts";

type PathfindingRequest = {
  target?: { x: number; y: number; z: number };
  radius?: number;
};

const restrictToNavmesh = async (ctx: Context): Promise<void> => {
  //parse the request body
  const body: DomainRequestBody & PathfindingRequest =
    await ctx.request.body.json();
  const { domainId, target, radius } = body;

  //input guards
  try {
    //ensure we have all required body parameters
    if (!domainId) throw new Error("Missing domain id");
    if (!target) throw new Error("Missing target");
  } catch (error) {
    ctx.response.status = 400;
    //@ts-expect-error check for .message on unknown
    ctx.response.body = { message: error.message ?? error };
    return;
  }

  const { domainServerUrl, authorization } = await EnterDomain(domainId);

  const { success, navMesh } = await loadNavmesh(
    domainServerUrl,
    domainId,
    authorization,
    0
  );

  if (!success || !navMesh) {
    ctx.response.body = { message: "failed to load navmesh" };
    ctx.response.status = 500;
    return;
  }

  const query = new NavMeshQuery(navMesh);

  //get the closest point on the navmesh
  const closestPointOnMesh = query.findClosestPoint(target, {
    halfExtents: new THREE.Vector3(100, 10, 100),
  });
  const restrictedPoint = new THREE.Vector3().copy(closestPointOnMesh.point);

  //get the direction from the target to the closest point on the navmesh
  const direction = new THREE.Vector3(
    target.x - restrictedPoint.x,
    target.y - restrictedPoint.y,
    target.z - restrictedPoint.z
  ).normalize();

  const minDistance = radius ?? 0;
  const distance = restrictedPoint.distanceTo(target);
  if (distance < minDistance) {
    //move closest point away until it is at least minDistance from target
    const moveDistance = minDistance - distance;
    restrictedPoint.sub(direction.multiplyScalar(moveDistance));
  }

  ctx.response.body = {
    original: target,
    restricted: {
      x: restrictedPoint.x,
      y: restrictedPoint.y,
      z: restrictedPoint.z,
    },
    direction: {
      x: direction.x,
      y: direction.y,
      z: direction.z,
    },
  };
};

export default restrictToNavmesh;
