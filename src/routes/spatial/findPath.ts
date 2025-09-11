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
};

export default async function findPath(ctx: Context): Promise<void> {
  //console.log("findPath");
  const body: DomainRequestBody & PathfindingRequest =
    await ctx.request.body.json();
  const { domainId, wayPoints, radius } = body;

  //input guards
  try {
    if (!domainId) throw new Error("Missing domain id");
    if (!wayPoints) throw new Error("Missing waypoints");
    //if (!radius) throw new Error("Missing radius");
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
  const onMeshPoints = getOnMeshPoints(query, wayPoints);
  const returnValue = new PathFindData();

  //console.log("begin pathfinding");
  for (let i = 0; i < onMeshPoints.length - 1; i++) {
    const start = onMeshPoints[i];
    const end = onMeshPoints[i + 1];

    const pathResult = computePath(query, start, end);

    //console.log("pathfinding result", pathResult.success, i);
    if (pathResult.success) {
      const newDistance = getRouteDistance(pathResult.path);
      returnValue.addPathSegment(start, end, pathResult.path, newDistance, i);
    }
  }

  //console.log("pathfinding complete");
  ctx.response.body = {
    ...returnValue.toBody(),
    waypoints: onMeshPoints,
  };

  //console.log("clean up");
  query.destroy();
  navMesh.destroy();

  //console.log("done");
}
