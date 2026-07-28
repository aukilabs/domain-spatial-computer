import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { NavMeshQuery } from "npm:@recast-navigation/core";
import { buildNavMesh, fetchNavmeshObj } from "../../utils/recast/navmesh.ts";
import getOnMeshPoints, { OnMeshPoint } from "../../utils/recast/getOnMeshPoints.ts";
import getRouteDistance from "../../utils/pathfinding/getRouteDistance.ts";
import computePath from "../../utils/recast/computePath.ts";
import { EnterDomain } from "../../utils/domain/enterDomain.ts";
import generateSegmentsFromMesh, {
  AreaBounds,
} from "../../utils/pathfinding/generateSegmentsFromMesh.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

type Vector3 = { x: number; y: number; z: number };

type PathSegmentsRequest = {
  radius?: number;
  fixedEnd?: boolean;
  area?: AreaBounds;
  start?: Vector3;
  end?: Vector3;
  interval?: number;
};

type SegmentInfo = {
  points: Vector3[];
  startOnMesh: OnMeshPoint;
  endOnMesh: OnMeshPoint;
  originalIdx: number;
};

export default async function findOptimizedSegmentPath(
  ctx: Context
): Promise<void> {
  const body: DomainRequestBody & PathSegmentsRequest =
    await ctx.request.body.json();
  const { domainId, radius, fixedEnd, area, start, end, interval } = body;

  if (!domainId) {
    ctx.response.status = 400;
    ctx.response.body = { message: "Missing domain id" };
    return;
  }

  const { domainServerUrl, authorization } = await EnterDomain(domainId);

  let navmeshObj;
  try {
    navmeshObj = await fetchNavmeshObj(domainServerUrl, domainId, authorization);
  } catch (_error) {
    ctx.response.status = 500;
    ctx.response.body = { message: "failed to load navmesh" };
    return;
  }

  // Generate one literal path segment per mesh object by sampling waypoints along its
  // principal axis, scoped to `area` if given, instead of accepting pre-computed segments.
  const scopedSegments = generateSegmentsFromMesh(navmeshObj, area, interval);

  if (scopedSegments.length < 1) {
    ctx.response.status = 400;
    ctx.response.body = {
      message: area
        ? "No mesh segments intersect the given area"
        : "No mesh segments found on the navmesh",
    };
    return;
  }

  const { success, navMesh } = await buildNavMesh(navmeshObj, radius);

  if (!success || !navMesh) {
    ctx.response.body = { message: "failed to load navmesh" };
    ctx.response.status = 500;
    return;
  }

  const query = new NavMeshQuery(navMesh);

  // Snap the first and last point of each segment to the navmesh.
  // Middle points are kept literally — only endpoints are used for connection pathfinding.
  const segments: SegmentInfo[] = scopedSegments.map((pts, idx) => {
    const [startOnMesh] = getOnMeshPoints(query, [pts[0]]);
    const [endOnMesh] = getOnMeshPoints(query, [pts[pts.length - 1]]);
    return { points: pts, startOnMesh, endOnMesh, originalIdx: idx };
  });

  const unvisited = [...segments];
  // With an explicit start point, every segment is free to be reordered by the
  // nearest-neighbor loop below. Without one, the first segment is kept fixed
  // and traversed literally, preserving prior behavior.
  const firstSeg = start ? undefined : unvisited.shift()!;
  const fixedEndSeg = fixedEnd ? unvisited.pop() : undefined;

  const fullPath: Vector3[] = [];
  const allSegments: Array<{
    points: THREE.Vector3Like[];
    hasOffMeshStart: boolean;
    hasOffMeshEnd: boolean;
  }> = [];
  const distances: number[] = [];
  const orderedSegmentIndices: number[] = [];
  const segmentsReversed: boolean[] = [];

  let currentExit: OnMeshPoint;

  if (start) {
    const [startOnMesh] = getOnMeshPoints(query, [start]);
    // Start from the walkable point pathfinding will actually route from, not the raw
    // coordinate — keeps the path continuous instead of jumping in from off-mesh.
    fullPath.push(startOnMesh.adjusted);
    currentExit = startOnMesh;
  } else {
    // Add first segment literally (always forward, no preceding connection)
    fullPath.push(...firstSeg!.points);
    allSegments.push({
      points: firstSeg!.points,
      hasOffMeshStart: firstSeg!.startOnMesh.isOffMesh,
      hasOffMeshEnd: firstSeg!.endOnMesh.isOffMesh,
    });
    distances.push(getRouteDistance(firstSeg!.points));
    orderedSegmentIndices.push(firstSeg!.originalIdx);
    segmentsReversed.push(false);
    currentExit = firstSeg!.endOnMesh;
  }

  const appendSegment = (seg: SegmentInfo, reversed: boolean) => {
    // Compute navmesh connection from current exit to this segment's entry
    const entryOnMesh = reversed ? seg.endOnMesh : seg.startOnMesh;
    const exitOnMesh = reversed ? seg.startOnMesh : seg.endOnMesh;

    const connectionResult = computePath(query, currentExit, entryOnMesh);
    const connectionPath = connectionResult.path;
    const connectionDist = getRouteDistance(connectionPath);

    // Connection segment (skip first point — duplicate of currentExit)
    fullPath.push(...connectionPath.slice(1));
    allSegments.push({
      points: connectionPath,
      hasOffMeshStart: currentExit.isOffMesh,
      hasOffMeshEnd: entryOnMesh.isOffMesh,
    });
    distances.push(connectionDist);

    // Literal segment (skip first point — duplicate of connection end)
    const segPoints = reversed ? [...seg.points].reverse() : seg.points;
    fullPath.push(...segPoints.slice(1));
    allSegments.push({
      points: segPoints,
      hasOffMeshStart: entryOnMesh.isOffMesh,
      hasOffMeshEnd: exitOnMesh.isOffMesh,
    });
    distances.push(getRouteDistance(segPoints));

    currentExit = exitOnMesh;
    orderedSegmentIndices.push(seg.originalIdx);
    segmentsReversed.push(reversed);
  };

  // Nearest-neighbor loop
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestReversed = false;
    let shortestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const seg = unvisited[i];

      const forwardPath = computePath(query, currentExit, seg.startOnMesh);
      const forwardDist = getRouteDistance(forwardPath.path);

      const reversedPath = computePath(query, currentExit, seg.endOnMesh);
      const reversedDist = getRouteDistance(reversedPath.path);

      const bestDist = Math.min(forwardDist, reversedDist);
      if (bestDist < shortestDist) {
        shortestDist = bestDist;
        nearestIdx = i;
        nearestReversed = reversedDist < forwardDist;
      }
    }

    const nextSeg = unvisited.splice(nearestIdx, 1)[0];
    appendSegment(nextSeg, nearestReversed);
  }

  if (fixedEndSeg) {
    // For the fixed end segment, still try both directions
    const forwardPath = computePath(query, currentExit, fixedEndSeg.startOnMesh);
    const reversedPath = computePath(query, currentExit, fixedEndSeg.endOnMesh);
    const reversed =
      getRouteDistance(reversedPath.path) < getRouteDistance(forwardPath.path);
    appendSegment(fixedEndSeg, reversed);
  }

  if (end) {
    // Final connection from wherever the route ended up to the walkable point closest
    // to the explicit end destination — keeps the route continuous end-to-end.
    const [endOnMesh] = getOnMeshPoints(query, [end]);
    const connectionResult = computePath(query, currentExit, endOnMesh);
    const connectionPath = connectionResult.path;

    fullPath.push(...connectionPath.slice(1));
    allSegments.push({
      points: connectionPath,
      hasOffMeshStart: currentExit.isOffMesh,
      hasOffMeshEnd: endOnMesh.isOffMesh,
    });
    distances.push(getRouteDistance(connectionPath));
  }

  ctx.response.body = {
    full: fullPath,
    segments: allSegments,
    totalDistance: distances.reduce((a, b) => a + b, 0),
    segmentsDistances: distances,
    orderedSegmentIndices,
    segmentsReversed,
  };

  query.destroy();
  navMesh.destroy();
}
