// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { Pose } from "../../types/mathTypes.ts";

export function GetRelativeMatrix(j: Pose, k: Pose) {
  //j rotation
  const jr = new THREE.Quaternion().copy(j.rotation);
  //k rotation
  const kr = new THREE.Quaternion().copy(k.rotation);
  //j position
  const jp = new THREE.Vector3().copy(j.position);
  //k position
  const kp = new THREE.Vector3().copy(k.position);
  //relative rotation
  const rr = jr.multiply(kr.invert());
  //target translation
  const tt = kp.negate().applyQuaternion(rr).add(jp);
  //translation matrix
  const tm = new THREE.Matrix4().compose(
    tt,
    new THREE.Quaternion().identity(),
    new THREE.Vector3(1, 1, 1)
  );
  //rotation matrix
  const rm = new THREE.Matrix4().compose(
    new THREE.Vector3(0, 0, 0),
    rr,
    new THREE.Vector3(1, 1, 1)
  );

  const result = tm.multiply(rm);
  return result;
}

export function ApplyRelativeMatrixToPose(matrix: THREE.Matrix4, pose: Pose) {
  const tempMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3().copy(pose.position),
    new THREE.Quaternion().copy(pose.rotation),
    new THREE.Vector3(1, 1, 1)
  );

  tempMatrix.premultiply(matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(tempMatrix);
  const rotation = new THREE.Quaternion().setFromRotationMatrix(tempMatrix);
  return { position, rotation };
}
