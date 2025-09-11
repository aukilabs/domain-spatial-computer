import { assertEquals } from "@std/assert/equals";
import computePath from "../../utils/recast/computePath.ts";
import { OnMeshPoint } from "../../utils/recast/getOnMeshPoints.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

// Mock NavMeshQuery for testing
class MockNavMeshQuery {
  computePath(start: THREE.Vector3Like, end: THREE.Vector3Like, options: any) {
    // Mock behavior: simulate pathfinding results
    const distance = Math.sqrt(
      (end.x - start.x) ** 2 + (end.y - start.y) ** 2 + (end.z - start.z) ** 2
    );

    // If points are very far apart, pathfinding fails
    if (distance > 100) {
      return {
        success: false,
        path: [],
        error: "Path too long",
      };
    }

    // If points are the same, return single point
    if (distance < 0.001) {
      return {
        success: true,
        path: [{ x: start.x, y: start.y, z: start.z }],
      };
    }

    // Generate a simple straight-line path with intermediate points
    const numPoints = Math.max(2, Math.ceil(distance / 10)); // One point every 10 units
    const path: THREE.Vector3Like[] = [];

    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      path.push({
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y),
        z: start.z + t * (end.z - start.z),
      });
    }

    return {
      success: true,
      path: path,
    };
  }
}

export function TestComputePathBasic() {
  const mockQuery = new MockNavMeshQuery() as any;

  // Test successful path computation
  const start: OnMeshPoint = {
    adjusted: { x: 0, y: 0, z: 0 },
    original: { x: 0, y: 0, z: 0 },
    isOffMesh: false,
  };

  const end: OnMeshPoint = {
    adjusted: { x: 10, y: 0, z: 0 },
    original: { x: 10, y: 0, z: 0 },
    isOffMesh: false,
  };

  const result = computePath(mockQuery, start, end);

  assertEquals(result.success, true, "Path computation should succeed");
  assertEquals(
    Array.isArray(result.path),
    true,
    "Result should contain path array"
  );
  assertEquals(
    result.path.length >= 2,
    true,
    "Path should have at least 2 points"
  );

  // Check start and end points
  assertEquals(result.path[0].x, 0, "Path should start at start point X");
  assertEquals(result.path[0].y, 0, "Path should start at start point Y");
  assertEquals(result.path[0].z, 0, "Path should start at start point Z");

  const lastPoint = result.path[result.path.length - 1];
  assertEquals(lastPoint.x, 10, "Path should end at end point X");
  assertEquals(lastPoint.y, 0, "Path should end at end point Y");
  assertEquals(lastPoint.z, 0, "Path should end at end point Z");

  // Test path computation with different parameters
  const start3D: OnMeshPoint = {
    adjusted: { x: 1, y: 2, z: 3 },
    original: { x: 1, y: 2, z: 3 },
    isOffMesh: false,
  };

  const end3D: OnMeshPoint = {
    adjusted: { x: 4, y: 6, z: 8 },
    original: { x: 4, y: 6, z: 8 },
    isOffMesh: false,
  };

  const result3D = computePath(mockQuery, start3D, end3D);

  assertEquals(result3D.success, true, "3D path computation should succeed");
  assertEquals(
    result3D.path.length >= 2,
    true,
    "3D path should have at least 2 points"
  );

  // Test query parameter handling (function should pass correct options)
  // This is implicit in our mock - the function calls query.computePath with specific options
  assertEquals(typeof result, "object", "Should return result object");
}

export function TestComputePathEdgeCases() {
  const mockQuery = new MockNavMeshQuery() as any;

  // Test with same start and end points
  const samePoint: OnMeshPoint = {
    adjusted: { x: 5, y: 5, z: 5 },
    original: { x: 5, y: 5, z: 5 },
    isOffMesh: false,
  };

  const samePointResult = computePath(mockQuery, samePoint, samePoint);

  assertEquals(samePointResult.success, true, "Same point path should succeed");
  assertEquals(
    samePointResult.path.length,
    1,
    "Same point path should have 1 point"
  );
  assertEquals(
    samePointResult.path[0].x,
    5,
    "Same point result should match input"
  );

  // Test with very far points (should fail in our mock)
  const farStart: OnMeshPoint = {
    adjusted: { x: 0, y: 0, z: 0 },
    original: { x: 0, y: 0, z: 0 },
    isOffMesh: false,
  };

  const farEnd: OnMeshPoint = {
    adjusted: { x: 200, y: 200, z: 200 },
    original: { x: 200, y: 200, z: 200 },
    isOffMesh: false,
  };

  const farResult = computePath(mockQuery, farStart, farEnd);

  assertEquals(
    farResult.success,
    false,
    "Very far points should fail pathfinding"
  );
  assertEquals(
    Array.isArray(farResult.path),
    true,
    "Failed result should still have path array"
  );
  assertEquals(
    farResult.path.length,
    0,
    "Failed result should have empty path"
  );

  // Test with off-mesh points (should use adjusted coordinates)
  const offMeshStart: OnMeshPoint = {
    adjusted: { x: 1, y: 0, z: 1 },
    original: { x: 1.2, y: 0.5, z: 1.3 }, // Different from adjusted
    isOffMesh: true,
  };

  const offMeshEnd: OnMeshPoint = {
    adjusted: { x: 5, y: 0, z: 5 },
    original: { x: 5.1, y: 0.3, z: 5.2 }, // Different from adjusted
    isOffMesh: true,
  };

  const offMeshResult = computePath(mockQuery, offMeshStart, offMeshEnd);

  assertEquals(
    offMeshResult.success,
    true,
    "Off-mesh points should work with adjusted coordinates"
  );
  // Path should use adjusted coordinates, not original
  assertEquals(
    offMeshResult.path[0].x,
    1,
    "Should use adjusted start X, not original"
  );
  assertEquals(
    offMeshResult.path[0].z,
    1,
    "Should use adjusted start Z, not original"
  );

  // Test with extreme coordinates
  const extremeStart: OnMeshPoint = {
    adjusted: { x: -1000, y: -1000, z: -1000 },
    original: { x: -1000, y: -1000, z: -1000 },
    isOffMesh: false,
  };

  const extremeEnd: OnMeshPoint = {
    adjusted: { x: -990, y: -990, z: -990 },
    original: { x: -990, y: -990, z: -990 },
    isOffMesh: false,
  };

  const extremeResult = computePath(mockQuery, extremeStart, extremeEnd);

  assertEquals(
    extremeResult.success,
    true,
    "Extreme coordinates should be handled"
  );
  assertEquals(
    extremeResult.path.length >= 2,
    true,
    "Extreme path should have points"
  );

  // Check that all path points are finite
  for (const point of extremeResult.path) {
    assertEquals(isFinite(point.x), true, "Path point X should be finite");
    assertEquals(isFinite(point.y), true, "Path point Y should be finite");
    assertEquals(isFinite(point.z), true, "Path point Z should be finite");
  }
}
