import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { NavMeshQuery } from "npm:@recast-navigation/core";
import { loadNavmesh } from "../../utils/recast/navmesh.ts";

type PathfindingRequest = {
  wayPoints?: { x: number; y: number; z: number }[];
  radius?: number;
  optimizeRoute?: boolean;
};

type OnMeshWaypoint = {
  point: THREE.Vector3Like;
  originalPoint: THREE.Vector3Like;
  isOffMesh: boolean;
};

function getRouteDistance(path: THREE.Vector3Like[]) {
  return path.reduce((acc, point, i) => {
    if (i === 0) return 0;
    const pointV3 = new THREE.Vector3(point.x, point.y, point.z);
    return acc + pointV3.distanceTo(path[i - 1]);
  }, 0);
}

function addToReturnValue(
  path: THREE.Vector3Like[],
  paths: Array<{
    points: THREE.Vector3Like[];
    hasOffMeshStart: boolean;
    hasOffMeshEnd: boolean;
  }>,
  distances: number[],
  start: OnMeshWaypoint,
  end: OnMeshWaypoint,
  pathResult: THREE.Vector3Like[],
  newDistance: number,
  index: number
) {
  const segmentPoints: THREE.Vector3Like[] = [];
  // Add initial off-mesh segment if needed
  if (start.isOffMesh) {
    segmentPoints.push(start.originalPoint);
  }

  // Add main path
  segmentPoints.push(...pathResult);

  // Add final off-mesh segment if needed
  if (end.isOffMesh) {
    segmentPoints.push(end.originalPoint);
  }

  // Add to full path (avoiding duplicates)
  if (index === 0) path.push(...segmentPoints);
  else path.push(...segmentPoints.slice(1));

  paths.push({
    points: segmentPoints,
    hasOffMeshStart: start.isOffMesh,
    hasOffMeshEnd: end.isOffMesh,
  });

  distances.push(newDistance);
}

const pathFind = async (ctx: Context): Promise<void> => {
  //console.log("pathFind");
  //parse the request body
  const body: DomainRequestBody & PathfindingRequest =
    await ctx.request.body.json();
  const { domainServerUrl, domainId, wayPoints, radius, optimizeRoute } = body;
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

  //console.log("start navmesh load");

  const shouldOptimize = !!optimizeRoute;

  const { success, navMesh } = await loadNavmesh(
    domainServerUrl,
    domainId,
    authorization,
    radius
  );

  //console.log("recast navmesh loaded");

  if (!success || !navMesh) {
    ctx.response.body = { message: "failed to load navmesh" };
    ctx.response.status = 500;
    return;
  }

  const query = new NavMeshQuery(navMesh);

  //console.log("start pathfinding query total waypoints", wayPoints.length);

  const onPathWaypoints: OnMeshWaypoint[] = wayPoints.map((waypoint, i) => {
    const closest = query.findClosestPoint(waypoint, {
      halfExtents: new THREE.Vector3(100, 10, 100),
    });
    //console.log(
    //  "closest point found ",
    //  i,
    //  !closest.success || !closest.isPointOverPoly
    //);
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
  const distances: number[] = [];

  if (shouldOptimize) {
    //console.log("begin optimization");

    // Use Nearest Neighbor algorithm
    const optimalRoute: typeof onPathWaypoints = [];

    const unvisited = [...onPathWaypoints];
    const start = unvisited.shift()!;

    let currentPos = start?.point;

    let i = 0;
    // Always start with the nearest point from current position
    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let shortestDistance = Infinity;
      let nearestPath: ReturnType<typeof query.computePath> | undefined;

      // Find the nearest unvisited destination
      unvisited.forEach((dest, idx) => {
        //console.log("distance calculated", nearestIdx, i);
        const pathResult = query.computePath(currentPos, dest.point);
        const distance = getRouteDistance(pathResult.path);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIdx = idx;
          nearestPath = pathResult;
        }
      });

      //console.log("optimal route point added", nearestIdx, i);

      // Add the nearest point to our route
      const nearest = unvisited.splice(nearestIdx, 1)[0];
      optimalRoute.push(nearest);

      addToReturnValue(
        path,
        paths,
        distances,
        start,
        nearest,
        nearestPath!.path,
        shortestDistance,
        i
      );

      // Update current position for next iteration
      currentPos = nearest.point;
      i++;
    }

    //console.log("optimal route complete");

    ctx.response.body = {
      full: path,
      segments: paths,
      waypoints: optimalRoute.map((wp) => ({
        original: wp.originalPoint,
        adjusted: wp.point,
        isOffMesh: wp.isOffMesh,
      })),
      totalDistance: distances.reduce((acc, curr) => acc + curr, 0),
      segmentsDistances: distances,
    };
  } else {
    //console.log("begin pathfinding");

    for (let i = 0; i < onPathWaypoints.length - 1; i++) {
      const start = onPathWaypoints[i];
      const end = onPathWaypoints[i + 1];

      const pathResult = query.computePath(start.point, end.point, {
        halfExtents: new THREE.Vector3(1000, 10, 1000),
        maxPathPolys: 1024,
        maxStraightPathPoints: 1024,
      });

      //console.log("pathfinding result", pathResult.success, i);

      if (pathResult.success) {
        const newDistance = getRouteDistance(pathResult.path);
        addToReturnValue(
          path,
          paths,
          distances,
          start,
          end,
          pathResult.path,
          newDistance,
          i
        );
      }
    }

    //console.log("pathfinding complete");
    ctx.response.body = {
      full: path,
      segments: paths,
      waypoints: onPathWaypoints.map((wp) => ({
        original: wp.originalPoint,
        adjusted: wp.point,
        isOffMesh: wp.isOffMesh,
      })),
      totalDistance: distances.reduce((acc, curr) => acc + curr, 0),
      segmentsDistances: distances,
    };
  }
};

export default pathFind;
