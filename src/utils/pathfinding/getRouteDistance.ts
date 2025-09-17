// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

function getRouteDistance(path: THREE.Vector3Like[]) {
  return path.reduce((acc, point, i) => {
    if (i === 0) return 0;
    const pointV3 = new THREE.Vector3(point.x, point.y, point.z);
    return acc + pointV3.distanceTo(path[i - 1]);
  }, 0);
}

export default getRouteDistance;
