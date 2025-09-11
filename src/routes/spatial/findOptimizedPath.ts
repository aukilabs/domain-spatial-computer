import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { NavMeshQuery } from "npm:@recast-navigation/core";
import { loadNavmesh } from "../../utils/recast/navmesh.ts";
import getOnMeshPoints from "../../utils/recast/getOnMeshPoints.ts";
import getRouteDistance from "../../utils/pathfinding/getRouteDistance.ts";
import { PathFindData } from "../../utils/pathfinding/pathFindData.ts";
import computePath from "../../utils/recast/computePath.ts";
import { EnterDomain } from "../../utils/domain/enterDomain.ts";

type PathfindingRequest = {
  wayPoints?: { x: number; y: number; z: number }[];
  radius?: number;
  fixedEnd?: boolean;
};

export default async function findOptimizedPath(ctx: Context): Promise<void> {
  //console.log("pathFind");
  const body: DomainRequestBody & PathfindingRequest =
    await ctx.request.body.json();
  const { domainId, wayPoints, radius, fixedEnd } = body;

  //input guards
  try {
    if (!domainId) throw new Error("Missing domain id");
    if (!wayPoints) throw new Error("Missing waypoints");
    if (wayPoints.length < 2) throw new Error("Not enough waypoints");
  } catch (error) {
    ctx.response.status = 400;
    //@ts-expect-error check for .message on unknown
    ctx.response.body = { message: error.message ?? error };
    return;
  }

  //console.log("enter the domain");
  const { domainServer, authorization } = await EnterDomain(domainId);

  //console.log("start navmesh load");
  const { success, navMesh } = await loadNavmesh(
    domainServer,
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

  //console.log("start pathfinding query total waypoints", wayPoints.length);
  const query = new NavMeshQuery(navMesh);
  const onMeshWaypoints = getOnMeshPoints(query, wayPoints);
  const returnValue = new PathFindData();

  //console.log("begin optimization");
  // Use Nearest Neighbor algorithm

  const unvisited = [...onMeshWaypoints];
  const start = unvisited.shift()!;
  const end = fixedEnd ? unvisited.pop()! : undefined;

  const optimalRoute: typeof onMeshWaypoints = [start];
  const optimalIndices: number[] = [0];

  let currentPos = start;

  let i = 0;
  // Always start with the nearest point from current position
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let shortestDistance = Infinity;
    let nearestPath: ReturnType<typeof query.computePath> | undefined;

    // Find the nearest unvisited destination
    unvisited.forEach((dest, idx) => {
      //console.log("distance calculated", nearestIdx, i);
      const pathResult = computePath(query, currentPos, dest);
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
    optimalIndices.push(onMeshWaypoints.indexOf(nearest));
    returnValue.addPathSegment(
      start,
      nearest,
      nearestPath!.path,
      shortestDistance,
      i
    );

    // Update current position for next iteration
    currentPos = nearest;
    i++;
  }

  if (end) {
    const pathToEnd = computePath(query, currentPos, end);
    const distance = getRouteDistance(pathToEnd.path);
    optimalRoute.push(end);
    optimalIndices.push(onMeshWaypoints.indexOf(end));
    returnValue.addPathSegment(start, end, pathToEnd!.path, distance, i);
  }

  //console.log("optimal route complete");

  ctx.response.body = {
    ...returnValue.toBody(),
    waypoints: optimalRoute,
    waypointIndices: optimalIndices,
  };

  //console.log("clean up");
  query.destroy();
  navMesh.destroy();

  //console.log("done");
}
