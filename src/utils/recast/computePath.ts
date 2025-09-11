import { OnMeshPoint } from "./getOnMeshPoints.ts";
import { NavMeshQuery } from "npm:@recast-navigation/core";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

export default function computePath(
  query: NavMeshQuery,
  start: OnMeshPoint,
  end: OnMeshPoint
) {
  return query.computePath(start.adjusted, end.adjusted, {
    halfExtents: new THREE.Vector3(1000, 10, 1000),
    maxPathPolys: 1024,
    maxStraightPathPoints: 1024,
  });
}
