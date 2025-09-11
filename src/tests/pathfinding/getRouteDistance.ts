import { assertEquals } from "@std/assert/equals";
import getRouteDistance from "../../utils/pathfinding/getRouteDistance.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

export function TestGetRouteDistanceBasic() {
  // Test simple straight line path
  const straightLinePath: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  ];

  const straightLineDistance = getRouteDistance(straightLinePath);
  assertEquals(
    Math.abs(straightLineDistance - 3) < 0.0001,
    true,
    `Straight line distance should be ~3, got ${straightLineDistance}`
  );

  // Test path with multiple segments
  const multiSegmentPath: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
    { x: 3, y: 4, z: 0 },
    { x: 0, y: 4, z: 0 },
  ];

  const multiSegmentDistance = getRouteDistance(multiSegmentPath);
  // Should be 3 + 4 + 3 = 10
  assertEquals(
    Math.abs(multiSegmentDistance - 10) < 0.0001,
    true,
    `Multi-segment distance should be ~10, got ${multiSegmentDistance}`
  );

  // Test path with zero distance segments
  const zeroSegmentPath: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }, // Same point
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 }, // Same point again
  ];

  const zeroSegmentDistance = getRouteDistance(zeroSegmentPath);
  // Should be 0 + 1 + 0 = 1
  assertEquals(
    Math.abs(zeroSegmentDistance - 1) < 0.0001,
    true,
    `Zero segment distance should be ~1, got ${zeroSegmentDistance}`
  );

  // Test single point path (should return 0)
  const singlePointPath: THREE.Vector3Like[] = [{ x: 5, y: 10, z: 15 }];

  const singlePointDistance = getRouteDistance(singlePointPath);
  assertEquals(
    singlePointDistance,
    0,
    `Single point distance should be 0, got ${singlePointDistance}`
  );

  // Test 3D path
  const threeDPath: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 2, y: 2, z: 2 },
  ];

  const threeDDistance = getRouteDistance(threeDPath);
  // Distance from (0,0,0) to (1,1,1) = sqrt(3)
  // Distance from (1,1,1) to (2,2,2) = sqrt(3)
  // Total = 2 * sqrt(3) ≈ 3.464
  const expectedDistance = 2 * Math.sqrt(3);
  assertEquals(
    Math.abs(threeDDistance - expectedDistance) < 0.0001,
    true,
    `3D path distance should be ~${expectedDistance}, got ${threeDDistance}`
  );
}

export function TestGetRouteDistanceEdgeCases() {
  // Test empty path array
  const emptyPath: THREE.Vector3Like[] = [];
  const emptyDistance = getRouteDistance(emptyPath);
  assertEquals(
    emptyDistance,
    0,
    `Empty path distance should be 0, got ${emptyDistance}`
  );
  // Test path with duplicate points
  const duplicatePath: THREE.Vector3Like[] = [
    { x: 1, y: 1, z: 1 },
    { x: 1, y: 1, z: 1 }, // Duplicate
    { x: 1, y: 1, z: 1 }, // Duplicate
    { x: 2, y: 2, z: 2 },
    { x: 2, y: 2, z: 2 }, // Duplicate
  ];

  const duplicateDistance = getRouteDistance(duplicatePath);
  // Should be 0 + 0 + sqrt(3) + 0 = sqrt(3)
  const expectedDuplicateDistance = Math.sqrt(3);
  assertEquals(
    Math.abs(duplicateDistance - expectedDuplicateDistance) < 0.0001,
    true,
    `Duplicate points distance should be ~${expectedDuplicateDistance}, got ${duplicateDistance}`
  );

  // Test path with negative coordinates
  const negativePath: THREE.Vector3Like[] = [
    { x: -10, y: -5, z: -2 },
    { x: -7, y: -3, z: 0 },
    { x: -4, y: -1, z: 2 },
    { x: -1, y: 1, z: 4 },
  ];

  const negativeDistance = getRouteDistance(negativePath);
  // Each segment moves (3, 2, 2) so distance = sqrt(3² + 2² + 2²) = sqrt(17)
  // Total = 3 * sqrt(17)
  const expectedNegativeDistance = 3 * Math.sqrt(17);
  assertEquals(
    Math.abs(negativeDistance - expectedNegativeDistance) < 0.0001,
    true,
    `Negative coordinates distance should be ~${expectedNegativeDistance}, got ${negativeDistance}`
  );

  // Test path with very long paths
  const longPath: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1000000, y: 1000000, z: 1000000 },
    { x: 2000000, y: 2000000, z: 2000000 },
  ];

  const longDistance = getRouteDistance(longPath);
  // Distance from (0,0,0) to (1000000,1000000,1000000) = 1000000 * sqrt(3)
  // Distance from (1000000,1000000,1000000) to (2000000,2000000,2000000) = 1000000 * sqrt(3)
  // Total = 2000000 * sqrt(3)
  const expectedLongDistance = 2000000 * Math.sqrt(3);
  assertEquals(
    Math.abs(longDistance - expectedLongDistance) < 0.1,
    true,
    `Long path distance should be ~${expectedLongDistance}, got ${longDistance}`
  );
}
