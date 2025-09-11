import { assertEquals } from "@std/assert/equals";
import { PathFindData } from "../../utils/pathfinding/pathFindData.ts";
import { OnMeshPoint } from "../../utils/recast/getOnMeshPoints.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

export function TestPathFindDataAddSegmentBasic() {
  const pathFindData = new PathFindData();

  // Test adding first segment with on-mesh points
  const start1: OnMeshPoint = {
    adjusted: { x: 0, y: 0, z: 0 },
    original: { x: 0, y: 0, z: 0 },
    isOffMesh: false,
  };

  const end1: OnMeshPoint = {
    adjusted: { x: 1, y: 0, z: 0 },
    original: { x: 1, y: 0, z: 0 },
    isOffMesh: false,
  };

  const pathResult1: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0.5, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ];

  pathFindData.addPathSegment(start1, end1, pathResult1, 1.0, 0);

  // Check that the segment was added correctly
  assertEquals(
    pathFindData.path.length,
    3,
    "First segment should have 3 points"
  );
  assertEquals(pathFindData.paths.length, 1, "Should have 1 segment");
  assertEquals(pathFindData.distances.length, 1, "Should have 1 distance");
  assertEquals(pathFindData.distances[0], 1.0, "Distance should be 1.0");
  assertEquals(
    pathFindData.paths[0].hasOffMeshStart,
    false,
    "Should not have off-mesh start"
  );
  assertEquals(
    pathFindData.paths[0].hasOffMeshEnd,
    false,
    "Should not have off-mesh end"
  );

  // Test adding subsequent segment
  const start2: OnMeshPoint = {
    adjusted: { x: 1, y: 0, z: 0 },
    original: { x: 1, y: 0, z: 0 },
    isOffMesh: false,
  };

  const end2: OnMeshPoint = {
    adjusted: { x: 2, y: 0, z: 0 },
    original: { x: 2, y: 0, z: 0 },
    isOffMesh: false,
  };

  const pathResult2: THREE.Vector3Like[] = [
    { x: 1, y: 0, z: 0 },
    { x: 1.5, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
  ];

  pathFindData.addPathSegment(start2, end2, pathResult2, 1.0, 1);

  // Check that the second segment was added correctly (avoiding duplicates)
  assertEquals(
    pathFindData.path.length,
    5,
    "Should have 5 points total (avoiding duplicate)"
  );
  assertEquals(pathFindData.paths.length, 2, "Should have 2 segments");
  assertEquals(pathFindData.distances.length, 2, "Should have 2 distances");

  // Test segments with off-mesh start/end
  const startOffMesh: OnMeshPoint = {
    adjusted: { x: 3, y: 0, z: 0 },
    original: { x: 2.8, y: 0.2, z: 0 },
    isOffMesh: true,
  };

  const endOffMesh: OnMeshPoint = {
    adjusted: { x: 4, y: 0, z: 0 },
    original: { x: 4.2, y: 0.2, z: 0 },
    isOffMesh: true,
  };

  const pathResult3: THREE.Vector3Like[] = [
    { x: 3, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ];

  pathFindData.addPathSegment(startOffMesh, endOffMesh, pathResult3, 1.5, 2);

  // Check that off-mesh points were added
  assertEquals(
    pathFindData.paths[2].hasOffMeshStart,
    true,
    "Should have off-mesh start"
  );
  assertEquals(
    pathFindData.paths[2].hasOffMeshEnd,
    true,
    "Should have off-mesh end"
  );
  assertEquals(
    pathFindData.paths[2].points.length,
    4,
    "Should have 4 points (off-mesh + path + off-mesh)"
  );
}

export function TestPathFindDataToBody() {
  const pathFindData = new PathFindData();

  // Add some test segments
  const start: OnMeshPoint = {
    adjusted: { x: 0, y: 0, z: 0 },
    original: { x: 0, y: 0, z: 0 },
    isOffMesh: false,
  };

  const end: OnMeshPoint = {
    adjusted: { x: 1, y: 0, z: 0 },
    original: { x: 1, y: 0, z: 0 },
    isOffMesh: false,
  };

  const pathResult: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ];

  pathFindData.addPathSegment(start, end, pathResult, 2.5, 0);
  pathFindData.addPathSegment(start, end, pathResult, 3.5, 1);

  const body = pathFindData.toBody();

  // Test transformation with multiple segments
  assertEquals(Array.isArray(body.full), true, "Full path should be an array");
  assertEquals(
    Array.isArray(body.segments),
    true,
    "Segments should be an array"
  );
  assertEquals(body.segments.length, 2, "Should have 2 segments");
  assertEquals(
    body.totalDistance,
    6.0,
    "Total distance should be 2.5 + 3.5 = 6.0"
  );
  assertEquals(
    Array.isArray(body.segmentsDistances),
    true,
    "Segment distances should be an array"
  );
  assertEquals(
    body.segmentsDistances.length,
    2,
    "Should have 2 segment distances"
  );
  assertEquals(
    body.segmentsDistances[0],
    2.5,
    "First segment distance should be 2.5"
  );
  assertEquals(
    body.segmentsDistances[1],
    3.5,
    "Second segment distance should be 3.5"
  );
}

export function TestPathFindDataAddSegmentEdgeCases() {
  const pathFindData = new PathFindData();

  // Test adding segment with zero distance
  const start: OnMeshPoint = {
    adjusted: { x: 0, y: 0, z: 0 },
    original: { x: 0, y: 0, z: 0 },
    isOffMesh: false,
  };

  const end: OnMeshPoint = {
    adjusted: { x: 0, y: 0, z: 0 }, // Same as start
    original: { x: 0, y: 0, z: 0 },
    isOffMesh: false,
  };

  const pathResult: THREE.Vector3Like[] = [{ x: 0, y: 0, z: 0 }];

  pathFindData.addPathSegment(start, end, pathResult, 0, 0);

  assertEquals(pathFindData.distances[0], 0, "Zero distance should be handled");
  assertEquals(pathFindData.path.length, 1, "Single point path should work");

  // Test adding segment with empty path
  const emptyPathResult: THREE.Vector3Like[] = [];
  pathFindData.addPathSegment(start, end, emptyPathResult, 0, 1);

  assertEquals(
    pathFindData.paths[1].points.length,
    0,
    "Empty path should be handled"
  );

  // Test adding segment with malformed data (very large coordinates)
  const extremeStart: OnMeshPoint = {
    adjusted: { x: 1e10, y: -1e10, z: 1e10 },
    original: { x: 1e10, y: -1e10, z: 1e10 },
    isOffMesh: false,
  };

  const extremeEnd: OnMeshPoint = {
    adjusted: { x: -1e10, y: 1e10, z: -1e10 },
    original: { x: -1e10, y: 1e10, z: -1e10 },
    isOffMesh: false,
  };

  const extremePathResult: THREE.Vector3Like[] = [
    { x: 1e10, y: -1e10, z: 1e10 },
    { x: -1e10, y: 1e10, z: -1e10 },
  ];

  pathFindData.addPathSegment(
    extremeStart,
    extremeEnd,
    extremePathResult,
    1e12,
    2
  );

  assertEquals(
    isFinite(pathFindData.distances[2]),
    true,
    "Extreme distance should be finite"
  );
  assertEquals(
    pathFindData.paths[2].points.length,
    2,
    "Extreme coordinates should be handled"
  );

  // Test duplicate segment handling (adding same segment multiple times)
  const duplicateStart: OnMeshPoint = {
    adjusted: { x: 5, y: 5, z: 5 },
    original: { x: 5, y: 5, z: 5 },
    isOffMesh: false,
  };

  const duplicateEnd: OnMeshPoint = {
    adjusted: { x: 6, y: 6, z: 6 },
    original: { x: 6, y: 6, z: 6 },
    isOffMesh: false,
  };

  const duplicatePathResult: THREE.Vector3Like[] = [
    { x: 5, y: 5, z: 5 },
    { x: 6, y: 6, z: 6 },
  ];

  // Add the same segment twice
  pathFindData.addPathSegment(
    duplicateStart,
    duplicateEnd,
    duplicatePathResult,
    1.5,
    3
  );
  pathFindData.addPathSegment(
    duplicateStart,
    duplicateEnd,
    duplicatePathResult,
    1.5,
    4
  );

  assertEquals(
    pathFindData.paths.length,
    5,
    "Should handle duplicate segments"
  );
  assertEquals(
    pathFindData.distances[3],
    1.5,
    "First duplicate should have correct distance"
  );
  assertEquals(
    pathFindData.distances[4],
    1.5,
    "Second duplicate should have correct distance"
  );
}

export function TestPathFindDataToBodyEdgeCases() {
  // Test with empty path data
  const emptyPathFindData = new PathFindData();
  const emptyBody = emptyPathFindData.toBody();

  assertEquals(
    emptyBody.full.length,
    0,
    "Empty data should return empty full path"
  );
  assertEquals(
    emptyBody.segments.length,
    0,
    "Empty data should return empty segments"
  );
  assertEquals(
    emptyBody.totalDistance,
    0,
    "Empty data should return zero total distance"
  );
  assertEquals(
    emptyBody.segmentsDistances.length,
    0,
    "Empty data should return empty segment distances"
  );

  // Test with zero distances
  const zeroDistanceData = new PathFindData();
  const start: OnMeshPoint = {
    adjusted: { x: 0, y: 0, z: 0 },
    original: { x: 0, y: 0, z: 0 },
    isOffMesh: false,
  };

  const end: OnMeshPoint = {
    adjusted: { x: 1, y: 1, z: 1 },
    original: { x: 1, y: 1, z: 1 },
    isOffMesh: false,
  };

  const pathResult: THREE.Vector3Like[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
  ];

  zeroDistanceData.addPathSegment(start, end, pathResult, 0, 0);
  zeroDistanceData.addPathSegment(start, end, pathResult, 0, 1);

  const zeroBody = zeroDistanceData.toBody();
  assertEquals(zeroBody.totalDistance, 0, "Zero distances should sum to zero");

  // Test with very large distances
  const largeDistanceData = new PathFindData();
  largeDistanceData.addPathSegment(start, end, pathResult, 1e15, 0);
  largeDistanceData.addPathSegment(start, end, pathResult, 1e15, 1);

  const largeBody = largeDistanceData.toBody();
  assertEquals(
    isFinite(largeBody.totalDistance),
    true,
    "Large distances should remain finite"
  );
  assertEquals(
    largeBody.totalDistance,
    2e15,
    "Large distances should sum correctly"
  );

  // Test with negative distances (edge case)
  const negativeDistanceData = new PathFindData();
  negativeDistanceData.addPathSegment(start, end, pathResult, -5, 0);
  negativeDistanceData.addPathSegment(start, end, pathResult, 10, 1);

  const negativeBody = negativeDistanceData.toBody();
  assertEquals(
    negativeBody.totalDistance,
    5,
    "Negative distances should be handled in sum"
  );
}
