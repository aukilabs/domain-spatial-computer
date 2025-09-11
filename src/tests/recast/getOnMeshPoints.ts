import { assertEquals } from "@std/assert/equals";
import getOnMeshPoints from "../../utils/recast/getOnMeshPoints.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

// Mock NavMeshQuery for testing
class MockNavMeshQuery {
  findClosestPoint(point: THREE.Vector3Like, options: any) {
    // Mock behavior: points within distance 10 from origin are "on mesh"
    const distance = Math.sqrt(point.x ** 2 + point.y ** 2 + point.z ** 2);

    if (distance > 10) {
      // Far points are off-mesh
      return {
        success: false,
        isPointOverPoly: false,
        point: { x: 0, y: 0, z: 0 }, // Default fallback
      };
    } else {
      // Close points are on-mesh, slightly adjusted to simulate navmesh snapping
      return {
        success: true,
        isPointOverPoly: true,
        point: {
          x: point.x * 0.95, // Slightly adjust coordinates
          y: point.y * 0.95,
          z: point.z * 0.95,
        },
      };
    }
  }
}

export function TestGetOnMeshPointsBasic() {
  const mockQuery = new MockNavMeshQuery() as any;

  const testPoints: THREE.Vector3Like[] = [
    { x: 1, y: 1, z: 1 }, // Should be on-mesh (distance ~1.73)
    { x: 5, y: 5, z: 5 }, // Should be on-mesh (distance ~8.66)
    { x: 15, y: 15, z: 15 }, // Should be off-mesh (distance ~25.98)
  ];

  const result = getOnMeshPoints(mockQuery, testPoints);

  // Test basic functionality
  assertEquals(
    result.length,
    3,
    "Should return same number of points as input"
  );

  // Test on-mesh points
  assertEquals(result[0].isOffMesh, false, "First point should be on-mesh");
  assertEquals(result[1].isOffMesh, false, "Second point should be on-mesh");

  // Test off-mesh point
  assertEquals(result[2].isOffMesh, true, "Third point should be off-mesh");

  // Test that original points are preserved
  assertEquals(result[0].original.x, 1, "Original X should be preserved");
  assertEquals(result[0].original.y, 1, "Original Y should be preserved");
  assertEquals(result[0].original.z, 1, "Original Z should be preserved");

  assertEquals(
    result[2].original.x,
    15,
    "Off-mesh original X should be preserved"
  );
  assertEquals(
    result[2].original.y,
    15,
    "Off-mesh original Y should be preserved"
  );
  assertEquals(
    result[2].original.z,
    15,
    "Off-mesh original Z should be preserved"
  );

  // Test that adjusted points are modified for on-mesh points
  assertEquals(
    Math.abs(result[0].adjusted.x - 0.95) < 0.0001,
    true,
    `Adjusted X should be ~0.95, got ${result[0].adjusted.x}`
  );
  assertEquals(
    Math.abs(result[0].adjusted.y - 0.95) < 0.0001,
    true,
    `Adjusted Y should be ~0.95, got ${result[0].adjusted.y}`
  );

  // Test that off-mesh points get fallback adjusted coordinates
  assertEquals(
    result[2].adjusted.x,
    0,
    "Off-mesh adjusted X should be fallback (0)"
  );
  assertEquals(
    result[2].adjusted.y,
    0,
    "Off-mesh adjusted Y should be fallback (0)"
  );
  assertEquals(
    result[2].adjusted.z,
    0,
    "Off-mesh adjusted Z should be fallback (0)"
  );
}

export function TestGetOnMeshPointsEdgeCases() {
  const mockQuery = new MockNavMeshQuery() as any;

  // Test empty array
  const emptyResult = getOnMeshPoints(mockQuery, []);
  assertEquals(emptyResult.length, 0, "Empty input should return empty array");

  // Test single point
  const singlePoint = [{ x: 2, y: 2, z: 2 }];
  const singleResult = getOnMeshPoints(mockQuery, singlePoint);
  assertEquals(
    singleResult.length,
    1,
    "Single point should return single result"
  );
  assertEquals(
    singleResult[0].isOffMesh,
    false,
    "Single point should be on-mesh"
  );

  // Test points at origin
  const originPoints = [{ x: 0, y: 0, z: 0 }];
  const originResult = getOnMeshPoints(mockQuery, originPoints);
  assertEquals(originResult.length, 1, "Origin point should be processed");
  assertEquals(originResult[0].isOffMesh, false, "Origin should be on-mesh");

  // Test negative coordinates
  const negativePoints = [{ x: -3, y: -4, z: -5 }];
  const negativeResult = getOnMeshPoints(mockQuery, negativePoints);
  assertEquals(
    negativeResult.length,
    1,
    "Negative coordinates should be processed"
  );
  // Distance = sqrt(9 + 16 + 25) = sqrt(50) ≈ 7.07, should be on-mesh
  assertEquals(
    negativeResult[0].isOffMesh,
    false,
    "Negative coordinates should be on-mesh"
  );
}
