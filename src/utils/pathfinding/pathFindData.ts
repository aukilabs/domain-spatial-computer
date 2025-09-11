// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { OnMeshPoint } from "../recast/getOnMeshPoints.ts";

export class PathFindData {
  path: THREE.Vector3Like[] = [];
  paths: Array<{
    points: THREE.Vector3Like[];
    hasOffMeshStart: boolean;
    hasOffMeshEnd: boolean;
  }> = [];
  distances: number[] = [];

  addPathSegment(
    start: OnMeshPoint,
    end: OnMeshPoint,
    pathResult: THREE.Vector3Like[],
    newDistance: number,
    index: number
  ) {
    const segmentPoints: THREE.Vector3Like[] = [];
    // Add initial off-mesh segment if needed
    if (start.isOffMesh) {
      segmentPoints.push(start.original);
    }

    // Add main path
    segmentPoints.push(...pathResult);

    // Add final off-mesh segment if needed
    if (end.isOffMesh) {
      segmentPoints.push(end.original);
    }

    // Add to full path (avoiding duplicates)
    if (index === 0) this.path.push(...segmentPoints);
    else this.path.push(...segmentPoints.slice(1));

    this.paths.push({
      points: segmentPoints,
      hasOffMeshStart: start.isOffMesh,
      hasOffMeshEnd: end.isOffMesh,
    });

    this.distances.push(newDistance);
  }

  toBody() {
    return {
      full: this.path,
      segments: this.paths,
      totalDistance: this.distances.reduce((acc, curr) => acc + curr, 0),
      segmentsDistances: this.distances,
    };
  }
}
