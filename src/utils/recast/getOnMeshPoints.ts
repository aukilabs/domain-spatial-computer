import { NavMeshQuery } from "npm:@recast-navigation/core";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

export type OnMeshPoint = {
  adjusted: THREE.Vector3Like;
  original: THREE.Vector3Like;
  isOffMesh: boolean;
};

function getOnMeshPoints(
  query: NavMeshQuery,
  points: THREE.Vector3Like[]
): OnMeshPoint[] {
  return points.map((point) => {
    const closest = query.findClosestPoint(point, {
      halfExtents: new THREE.Vector3(100, 10, 100),
    });
    //console.log(
    //  "closest point found ",
    //  i,
    //  !closest.success || !closest.isPointOverPoly
    //);
    return {
      adjusted: closest.point,
      original: point,
      isOffMesh: !closest.success || !closest.isPointOverPoly,
    };
  });
}

export default getOnMeshPoints;
