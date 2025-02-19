import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { NavMeshQuery } from "npm:@recast-navigation/core";
import { loadNavmesh } from "../../utils/recast/navmesh.ts";

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
    //if (!radius) throw new Error("Missing radius");
    if (wayPoints.length < 2) throw new Error("Not enough waypoints");
    //ensure we have an auth token
    if (!authorization) throw new Error("Missing authorization");
  } catch (error) {
    ctx.response.status = 400;
    //@ts-expect-error check for .message on unknown
    ctx.response.body = { message: error.message ?? error };
    return;
  }

  const { success, navMesh } = await loadNavmesh(
    domainServerUrl,
    domainId,
    authorization,
    radius
  );

  if (!success || !navMesh) {
    ctx.response.body = { message: "failed to load navmesh" };
    ctx.response.status = 500;
    return;
  }

  const query = new NavMeshQuery(navMesh);

  const onPathWaypoints = wayPoints.map((waypoint) => {
    const closest = query.findClosestPoint(waypoint, {
      halfExtents: new THREE.Vector3(100, 10, 100),
    });
    return {
      ...closest,
      originalPoint: waypoint,
      isOffMesh: !closest.success || !closest.isPointOverPoly,
    };
  });

  const path: THREE.Vector3Like[] = [];
  const paths: Array<{
    points: THREE.Vector3Like[];
    hasOffMeshStart: boolean;
    hasOffMeshEnd: boolean;
  }> = [];

  for (let i = 0; i < onPathWaypoints.length - 1; i++) {
    const start = onPathWaypoints[i];
    const end = onPathWaypoints[i + 1];

    const pathResult = query.computePath(start.point, end.point, {
      halfExtents: new THREE.Vector3(1000, 10, 1000),
      maxPathPolys: 1024,
      maxStraightPathPoints: 1024,
    });

    if (pathResult.success) {
      const segmentPoints: THREE.Vector3Like[] = [];

      // Add initial off-mesh segment if needed
      if (start.isOffMesh) {
        segmentPoints.push(start.originalPoint);
      }

      // Add main path
      segmentPoints.push(...pathResult.path);

      // Add final off-mesh segment if needed
      if (end.isOffMesh) {
        segmentPoints.push(end.originalPoint);
      }

      // Add to full path (avoiding duplicates)
      if (i === 0) path.push(...segmentPoints);
      else path.push(...segmentPoints.slice(1));

      paths.push({
        points: segmentPoints,
        hasOffMeshStart: start.isOffMesh,
        hasOffMeshEnd: end.isOffMesh,
      });
    }
  }

  ctx.response.body = {
    full: path,
    segments: paths,
    waypoints: onPathWaypoints.map((wp) => ({
      original: wp.originalPoint,
      adjusted: wp.point,
      isOffMesh: wp.isOffMesh,
    })),
  };
};

export default pathFind;
