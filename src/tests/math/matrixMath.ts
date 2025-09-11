import { assertEquals } from "@std/assert/equals";
import { Pose } from "../../types/mathTypes.ts";
import {
  GetRelativeMatrix,
  ApplyRelativeMatrixToPose,
} from "../../utils/math/matrixMath.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

export function TestGetRelativeMatrix() {
  // Test identity transformation (same pose)
  const identityPose: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const identityMatrix = GetRelativeMatrix(identityPose, identityPose);

  // Should be identity matrix (or very close due to floating point)
  const expectedIdentity = new THREE.Matrix4().identity();
  assertEquals(identityMatrix.elements.length, 16);

  // Check that it's close to identity matrix
  for (let i = 0; i < 16; i++) {
    const expected = expectedIdentity.elements[i];
    const actual = identityMatrix.elements[i];
    assertEquals(
      Math.abs(actual - expected) < 0.0001,
      true,
      `Element ${i} should be close to ${expected}, got ${actual}`
    );
  }

  // Test translation-only transformation
  const pose1: Pose = {
    position: { x: 5, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const pose2: Pose = {
    position: { x: 10, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const translationMatrix = GetRelativeMatrix(pose1, pose2);

  // Should translate by (-5, 0, 0) from pose2 to pose1
  const translation = new THREE.Vector3().setFromMatrixPosition(
    translationMatrix
  );
  assertEquals(
    Math.abs(translation.x - -5) < 0.0001,
    true,
    `Translation X should be ~-5, got ${translation.x}`
  );
  assertEquals(
    Math.abs(translation.y) < 0.0001,
    true,
    `Translation Y should be ~0, got ${translation.y}`
  );
  assertEquals(
    Math.abs(translation.z) < 0.0001,
    true,
    `Translation Z should be ~0, got ${translation.z}`
  );

  // Test rotation-only transformation (90 degrees around Z)
  const pose3: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: {
      x: 0,
      y: 0,
      z: Math.sin(Math.PI / 4),
      w: Math.cos(Math.PI / 4),
    }, // 90 degrees
  };

  const pose4: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }, // no rotation
  };

  const rotationMatrix = GetRelativeMatrix(pose3, pose4);

  // Check that it's a rotation matrix (orthogonal, determinant = 1)
  const determinant = rotationMatrix.determinant();
  assertEquals(
    Math.abs(determinant - 1) < 0.0001,
    true,
    `Determinant should be ~1, got ${determinant}`
  );

  // Test combined translation + rotation
  const pose5: Pose = {
    position: { x: 1, y: 2, z: 3 },
    rotation: {
      x: 0,
      y: 0,
      z: Math.sin(Math.PI / 4),
      w: Math.cos(Math.PI / 4),
    },
  };

  const pose6: Pose = {
    position: { x: 4, y: 5, z: 6 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const combinedMatrix = GetRelativeMatrix(pose5, pose6);

  // Should be a valid transformation matrix
  assertEquals(combinedMatrix.elements.length, 16);

  // Test that the matrix correctly transforms pose6 to pose5
  // Create a test point at pose6's position
  const testPoint = new THREE.Vector3(
    pose6.position.x,
    pose6.position.y,
    pose6.position.z
  );
  testPoint.applyMatrix4(combinedMatrix);

  // The result should be close to pose5's position
  assertEquals(
    Math.abs(testPoint.x - pose5.position.x) < 0.1,
    true,
    `Transformed X should be ~${pose5.position.x}, got ${testPoint.x}`
  );
  assertEquals(
    Math.abs(testPoint.y - pose5.position.y) < 0.1,
    true,
    `Transformed Y should be ~${pose5.position.y}, got ${testPoint.y}`
  );
  assertEquals(
    Math.abs(testPoint.z - pose5.position.z) < 0.1,
    true,
    `Transformed Z should be ~${pose5.position.z}, got ${testPoint.z}`
  );
}

export function TestGetRelativeMatrixEdgeCases() {
  // Test with zero positions
  const zeroPose1: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const zeroPose2: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const zeroMatrix = GetRelativeMatrix(zeroPose1, zeroPose2);
  const expectedIdentity = new THREE.Matrix4().identity();

  // Should be identity matrix
  for (let i = 0; i < 16; i++) {
    assertEquals(
      Math.abs(zeroMatrix.elements[i] - expectedIdentity.elements[i]) < 0.0001,
      true,
      `Zero pose matrix element ${i} should be identity`
    );
  }

  // Test with zero rotations (but different positions)
  const poseWithZeroRotation1: Pose = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const poseWithZeroRotation2: Pose = {
    position: { x: 4, y: 5, z: 6 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const zeroRotationMatrix = GetRelativeMatrix(
    poseWithZeroRotation1,
    poseWithZeroRotation2
  );
  const translation = new THREE.Vector3().setFromMatrixPosition(
    zeroRotationMatrix
  );

  // Should be pure translation: pose1 - pose2 = (1,2,3) - (4,5,6) = (-3,-3,-3)
  assertEquals(
    Math.abs(translation.x - -3) < 0.0001,
    true,
    `Zero rotation translation X should be ~-3, got ${translation.x}`
  );
  assertEquals(
    Math.abs(translation.y - -3) < 0.0001,
    true,
    `Zero rotation translation Y should be ~-3, got ${translation.y}`
  );
  assertEquals(
    Math.abs(translation.z - -3) < 0.0001,
    true,
    `Zero rotation translation Z should be ~-3, got ${translation.z}`
  );

  // Test with extreme values
  const extremePose1: Pose = {
    position: { x: 1e6, y: -1e6, z: 1e6 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const extremePose2: Pose = {
    position: { x: -1e6, y: 1e6, z: -1e6 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const extremeMatrix = GetRelativeMatrix(extremePose1, extremePose2);

  // Should handle extreme values without overflow
  assertEquals(extremeMatrix.elements.length, 16);

  // Check that all elements are finite numbers
  for (let i = 0; i < 16; i++) {
    assertEquals(
      isFinite(extremeMatrix.elements[i]),
      true,
      `Extreme value matrix element ${i} should be finite, got ${extremeMatrix.elements[i]}`
    );
  }

  // Test with negative coordinates
  const negativePose1: Pose = {
    position: { x: -10, y: -20, z: -30 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const negativePose2: Pose = {
    position: { x: -5, y: -15, z: -25 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const negativeMatrix = GetRelativeMatrix(negativePose1, negativePose2);
  const negativeTranslation = new THREE.Vector3().setFromMatrixPosition(
    negativeMatrix
  );

  // Should handle negative coordinates correctly: pose1 - pose2 = (-10,-20,-30) - (-5,-15,-25) = (-5,-5,-5)
  assertEquals(
    Math.abs(negativeTranslation.x - -5) < 0.0001,
    true,
    `Negative coordinates translation X should be ~-5, got ${negativeTranslation.x}`
  );
  assertEquals(
    Math.abs(negativeTranslation.y - -5) < 0.0001,
    true,
    `Negative coordinates translation Y should be ~-5, got ${negativeTranslation.y}`
  );
  assertEquals(
    Math.abs(negativeTranslation.z - -5) < 0.0001,
    true,
    `Negative coordinates translation Z should be ~-5, got ${negativeTranslation.z}`
  );

  // Test with very small rotations (near identity)
  const smallRotationPose1: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0.001, w: 0.9999995 }, // Very small rotation
  };

  const smallRotationPose2: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const smallRotationMatrix = GetRelativeMatrix(
    smallRotationPose1,
    smallRotationPose2
  );

  // Should be close to identity matrix
  const smallRotationDeterminant = smallRotationMatrix.determinant();
  assertEquals(
    Math.abs(smallRotationDeterminant - 1) < 0.01,
    true,
    `Small rotation determinant should be close to 1, got ${smallRotationDeterminant}`
  );

  // Test with very large rotations
  const largeRotationPose1: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: Math.sin(Math.PI), w: Math.cos(Math.PI) }, // 180 degrees
  };

  const largeRotationPose2: Pose = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const largeRotationMatrix = GetRelativeMatrix(
    largeRotationPose1,
    largeRotationPose2
  );

  // Should still be a valid rotation matrix
  const largeRotationDeterminant = largeRotationMatrix.determinant();
  assertEquals(
    Math.abs(largeRotationDeterminant - 1) < 0.0001,
    true,
    `Large rotation determinant should be ~1, got ${largeRotationDeterminant}`
  );
}

export function TestApplyRelativeMatrixToPose() {
  // Test applying identity matrix
  const identityMatrix = new THREE.Matrix4().identity();
  const testPose: Pose = {
    position: { x: 5, y: 10, z: 15 },
    rotation: {
      x: 0,
      y: 0,
      z: Math.sin(Math.PI / 4),
      w: Math.cos(Math.PI / 4),
    },
  };

  const result = ApplyRelativeMatrixToPose(identityMatrix, testPose);

  // Should return the same pose
  assertEquals(
    Math.abs(result.position.x - testPose.position.x) < 0.0001,
    true,
    `Identity matrix position X should be unchanged, got ${result.position.x}`
  );
  assertEquals(
    Math.abs(result.position.y - testPose.position.y) < 0.0001,
    true,
    `Identity matrix position Y should be unchanged, got ${result.position.y}`
  );
  assertEquals(
    Math.abs(result.position.z - testPose.position.z) < 0.0001,
    true,
    `Identity matrix position Z should be unchanged, got ${result.position.z}`
  );
  assertEquals(
    Math.abs(result.rotation.x - testPose.rotation.x) < 0.0001,
    true,
    `Identity matrix rotation X should be unchanged, got ${result.rotation.x}`
  );
  assertEquals(
    Math.abs(result.rotation.y - testPose.rotation.y) < 0.0001,
    true,
    `Identity matrix rotation Y should be unchanged, got ${result.rotation.y}`
  );
  assertEquals(
    Math.abs(result.rotation.z - testPose.rotation.z) < 0.0001,
    true,
    `Identity matrix rotation Z should be unchanged, got ${result.rotation.z}`
  );
  assertEquals(
    Math.abs(result.rotation.w - testPose.rotation.w) < 0.0001,
    true,
    `Identity matrix rotation W should be unchanged, got ${result.rotation.w}`
  );

  // Test applying translation matrix
  const translationMatrix = new THREE.Matrix4().makeTranslation(3, 4, 5);
  const originalPose: Pose = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const translatedResult = ApplyRelativeMatrixToPose(
    translationMatrix,
    originalPose
  );

  // Position should be translated by (3, 4, 5)
  assertEquals(
    Math.abs(translatedResult.position.x - 4) < 0.0001,
    true,
    `Translation matrix position X should be ~4, got ${translatedResult.position.x}`
  );
  assertEquals(
    Math.abs(translatedResult.position.y - 6) < 0.0001,
    true,
    `Translation matrix position Y should be ~6, got ${translatedResult.position.y}`
  );
  assertEquals(
    Math.abs(translatedResult.position.z - 8) < 0.0001,
    true,
    `Translation matrix position Z should be ~8, got ${translatedResult.position.z}`
  );

  // Rotation should be unchanged for pure translation
  assertEquals(
    Math.abs(translatedResult.rotation.x - originalPose.rotation.x) < 0.0001,
    true,
    `Translation matrix rotation X should be unchanged`
  );
  assertEquals(
    Math.abs(translatedResult.rotation.y - originalPose.rotation.y) < 0.0001,
    true,
    `Translation matrix rotation Y should be unchanged`
  );
  assertEquals(
    Math.abs(translatedResult.rotation.z - originalPose.rotation.z) < 0.0001,
    true,
    `Translation matrix rotation Z should be unchanged`
  );
  assertEquals(
    Math.abs(translatedResult.rotation.w - originalPose.rotation.w) < 0.0001,
    true,
    `Translation matrix rotation W should be unchanged`
  );

  // Test applying rotation matrix
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(Math.PI / 2); // 90 degrees around Z
  const poseToRotate: Pose = {
    position: { x: 1, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const rotatedResult = ApplyRelativeMatrixToPose(rotationMatrix, poseToRotate);

  // Position should be rotated: (1,0,0) rotated 90° around Z becomes (0,1,0)
  assertEquals(
    Math.abs(rotatedResult.position.x) < 0.0001,
    true,
    `Rotation matrix position X should be ~0, got ${rotatedResult.position.x}`
  );
  assertEquals(
    Math.abs(rotatedResult.position.y - 1) < 0.0001,
    true,
    `Rotation matrix position Y should be ~1, got ${rotatedResult.position.y}`
  );
  assertEquals(
    Math.abs(rotatedResult.position.z) < 0.0001,
    true,
    `Rotation matrix position Z should be ~0, got ${rotatedResult.position.z}`
  );

  // Test applying combined transformation matrix
  const combinedMatrix = new THREE.Matrix4()
    .makeTranslation(2, 3, 4)
    .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 4)); // 45 degrees + translation

  const combinedPose: Pose = {
    position: { x: 1, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const combinedResult = ApplyRelativeMatrixToPose(
    combinedMatrix,
    combinedPose
  );

  // Should apply both translation and rotation
  assertEquals(
    combinedResult.position.x !== combinedPose.position.x,
    true,
    `Combined transformation should change position X`
  );
  assertEquals(
    combinedResult.position.y !== combinedPose.position.y,
    true,
    `Combined transformation should change position Y`
  );

  // Result should be finite numbers
  assertEquals(
    isFinite(combinedResult.position.x),
    true,
    `Combined result position X should be finite`
  );
  assertEquals(
    isFinite(combinedResult.position.y),
    true,
    `Combined result position Y should be finite`
  );
  assertEquals(
    isFinite(combinedResult.position.z),
    true,
    `Combined result position Z should be finite`
  );
  assertEquals(
    isFinite(combinedResult.rotation.x),
    true,
    `Combined result rotation X should be finite`
  );
  assertEquals(
    isFinite(combinedResult.rotation.y),
    true,
    `Combined result rotation Y should be finite`
  );
  assertEquals(
    isFinite(combinedResult.rotation.z),
    true,
    `Combined result rotation Z should be finite`
  );
  assertEquals(
    isFinite(combinedResult.rotation.w),
    true,
    `Combined result rotation W should be finite`
  );
}

export function TestApplyRelativeMatrixToPoseEdgeCases() {
  // Test with zero matrix
  const zeroMatrix = new THREE.Matrix4().set(
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  );
  const testPose: Pose = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const zeroResult = ApplyRelativeMatrixToPose(zeroMatrix, testPose);

  // Should return zero position and potentially invalid rotation
  assertEquals(
    zeroResult.position.x,
    0,
    `Zero matrix should result in zero position X`
  );
  assertEquals(
    zeroResult.position.y,
    0,
    `Zero matrix should result in zero position Y`
  );
  assertEquals(
    zeroResult.position.z,
    0,
    `Zero matrix should result in zero position Z`
  );

  // Rotation might be NaN or invalid with zero matrix
  assertEquals(
    isFinite(zeroResult.rotation.x),
    true,
    `Zero matrix rotation X should be finite`
  );
  assertEquals(
    isFinite(zeroResult.rotation.y),
    true,
    `Zero matrix rotation Y should be finite`
  );
  assertEquals(
    isFinite(zeroResult.rotation.z),
    true,
    `Zero matrix rotation Z should be finite`
  );
  assertEquals(
    isFinite(zeroResult.rotation.w),
    true,
    `Zero matrix rotation W should be finite`
  );

  // Test with extreme values in pose
  const extremePose: Pose = {
    position: { x: 1e6, y: -1e6, z: 1e6 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const identityMatrix = new THREE.Matrix4().identity();
  const extremeResult = ApplyRelativeMatrixToPose(identityMatrix, extremePose);

  // Should handle extreme values without overflow
  assertEquals(
    isFinite(extremeResult.position.x),
    true,
    `Extreme pose position X should be finite, got ${extremeResult.position.x}`
  );
  assertEquals(
    isFinite(extremeResult.position.y),
    true,
    `Extreme pose position Y should be finite, got ${extremeResult.position.y}`
  );
  assertEquals(
    isFinite(extremeResult.position.z),
    true,
    `Extreme pose position Z should be finite, got ${extremeResult.position.z}`
  );
  assertEquals(
    isFinite(extremeResult.rotation.x),
    true,
    `Extreme pose rotation X should be finite`
  );
  assertEquals(
    isFinite(extremeResult.rotation.y),
    true,
    `Extreme pose rotation Y should be finite`
  );
  assertEquals(
    isFinite(extremeResult.rotation.z),
    true,
    `Extreme pose rotation Z should be finite`
  );
  assertEquals(
    isFinite(extremeResult.rotation.w),
    true,
    `Extreme pose rotation W should be finite`
  );

  // Test with malformed quaternion (non-normalized)
  const malformedPose: Pose = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 10, y: 20, z: 30, w: 40 }, // Not normalized
  };

  const malformedResult = ApplyRelativeMatrixToPose(
    identityMatrix,
    malformedPose
  );

  // Should still produce finite results even with malformed quaternion
  assertEquals(
    isFinite(malformedResult.position.x),
    true,
    `Malformed quaternion position X should be finite`
  );
  assertEquals(
    isFinite(malformedResult.position.y),
    true,
    `Malformed quaternion position Y should be finite`
  );
  assertEquals(
    isFinite(malformedResult.position.z),
    true,
    `Malformed quaternion position Z should be finite`
  );
  assertEquals(
    isFinite(malformedResult.rotation.x),
    true,
    `Malformed quaternion rotation X should be finite`
  );
  assertEquals(
    isFinite(malformedResult.rotation.y),
    true,
    `Malformed quaternion rotation Y should be finite`
  );
  assertEquals(
    isFinite(malformedResult.rotation.z),
    true,
    `Malformed quaternion rotation Z should be finite`
  );
  assertEquals(
    isFinite(malformedResult.rotation.w),
    true,
    `Malformed quaternion rotation W should be finite`
  );

  // Test with very small values
  const smallPose: Pose = {
    position: { x: 1e-10, y: 2e-10, z: 3e-10 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const smallResult = ApplyRelativeMatrixToPose(identityMatrix, smallPose);

  // Should handle very small values
  assertEquals(
    isFinite(smallResult.position.x),
    true,
    `Small pose position X should be finite, got ${smallResult.position.x}`
  );
  assertEquals(
    isFinite(smallResult.position.y),
    true,
    `Small pose position Y should be finite, got ${smallResult.position.y}`
  );
  assertEquals(
    isFinite(smallResult.position.z),
    true,
    `Small pose position Z should be finite, got ${smallResult.position.z}`
  );

  // Test with matrix containing very large values
  const largeMatrix = new THREE.Matrix4().set(
    1e6,
    0,
    0,
    0,
    0,
    1e6,
    0,
    0,
    0,
    0,
    1e6,
    0,
    0,
    0,
    0,
    1
  );

  const normalPose: Pose = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const largeMatrixResult = ApplyRelativeMatrixToPose(largeMatrix, normalPose);

  // Should handle large matrix values
  assertEquals(
    isFinite(largeMatrixResult.position.x),
    true,
    `Large matrix result position X should be finite, got ${largeMatrixResult.position.x}`
  );
  assertEquals(
    isFinite(largeMatrixResult.position.y),
    true,
    `Large matrix result position Y should be finite, got ${largeMatrixResult.position.y}`
  );
  assertEquals(
    isFinite(largeMatrixResult.position.z),
    true,
    `Large matrix result position Z should be finite, got ${largeMatrixResult.position.z}`
  );

  // Test with negative values
  const negativePose: Pose = {
    position: { x: -10, y: -20, z: -30 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  };

  const negativeMatrix = new THREE.Matrix4().makeTranslation(-5, -10, -15);
  const negativeResult = ApplyRelativeMatrixToPose(
    negativeMatrix,
    negativePose
  );

  // Should handle negative values correctly
  assertEquals(
    isFinite(negativeResult.position.x),
    true,
    `Negative values position X should be finite, got ${negativeResult.position.x}`
  );
  assertEquals(
    isFinite(negativeResult.position.y),
    true,
    `Negative values position Y should be finite, got ${negativeResult.position.y}`
  );
  assertEquals(
    isFinite(negativeResult.position.z),
    true,
    `Negative values position Z should be finite, got ${negativeResult.position.z}`
  );

  // Test with quaternion containing very small values
  const smallQuaternionPose: Pose = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 1e-10, y: 2e-10, z: 3e-10, w: 1 },
  };

  const smallQuaternionResult = ApplyRelativeMatrixToPose(
    identityMatrix,
    smallQuaternionPose
  );

  // Should handle small quaternion values
  assertEquals(
    isFinite(smallQuaternionResult.position.x),
    true,
    `Small quaternion position X should be finite`
  );
  assertEquals(
    isFinite(smallQuaternionResult.position.y),
    true,
    `Small quaternion position Y should be finite`
  );
  assertEquals(
    isFinite(smallQuaternionResult.position.z),
    true,
    `Small quaternion position Z should be finite`
  );
  assertEquals(
    isFinite(smallQuaternionResult.rotation.x),
    true,
    `Small quaternion rotation X should be finite`
  );
  assertEquals(
    isFinite(smallQuaternionResult.rotation.y),
    true,
    `Small quaternion rotation Y should be finite`
  );
  assertEquals(
    isFinite(smallQuaternionResult.rotation.z),
    true,
    `Small quaternion rotation Z should be finite`
  );
  assertEquals(
    isFinite(smallQuaternionResult.rotation.w),
    true,
    `Small quaternion rotation W should be finite`
  );
}
