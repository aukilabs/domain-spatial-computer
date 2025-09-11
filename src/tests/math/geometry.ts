import { assertEquals, assert } from "@std/assert";
import { SetGeometryFromOBJ } from "../../utils/math/geometry.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";

export function TestSetGeometryFromOBJBasic() {
  // Create a simple test OBJ model data (unit cube)
  const testModel = {
    name: "test_cube",
    vertices: new Float32Array([
      // Bottom face
      -1,
      -1,
      -1, // 0
      1,
      -1,
      -1, // 1
      1,
      -1,
      1, // 2
      -1,
      -1,
      1, // 3
      // Top face
      -1,
      1,
      -1, // 4
      1,
      1,
      -1, // 5
      1,
      1,
      1, // 6
      -1,
      1,
      1, // 7
    ]),
    indices: new Uint16Array([
      // Bottom face
      0, 1, 2, 0, 2, 3,
      // Top face
      4, 6, 5, 4, 7, 6,
      // Front face
      0, 4, 5, 0, 5, 1,
      // Back face
      2, 6, 7, 2, 7, 3,
      // Left face
      0, 3, 7, 0, 7, 4,
      // Right face
      1, 5, 6, 1, 6, 2,
    ]),
  };

  // Create a new BufferGeometry
  const geometry = new THREE.BufferGeometry();

  // Call SetGeometryFromOBJ
  SetGeometryFromOBJ(testModel, geometry);

  // Test that vertices were set correctly
  const positionAttribute = geometry.getAttribute("position");
  assertEquals(positionAttribute.count, 8); // 8 vertices
  assertEquals(positionAttribute.itemSize, 3); // 3 components per vertex

  // Test specific vertex values
  const vertices = positionAttribute.array as Float32Array;
  assertEquals(vertices[0], -1); // First vertex X
  assertEquals(vertices[1], -1); // First vertex Y
  assertEquals(vertices[2], -1); // First vertex Z
  assertEquals(vertices[21], -1); // Last vertex X (7th vertex)
  assertEquals(vertices[22], 1); // Last vertex Y
  assertEquals(vertices[23], 1); // Last vertex Z

  // Test that indices were set correctly
  const indexAttribute = geometry.getIndex();
  assert(indexAttribute !== null, "Index attribute should be set");
  assertEquals(indexAttribute!.count, 36); // 12 triangles * 3 indices each

  const indices = indexAttribute!.array as Uint16Array;
  assertEquals(indices[0], 0); // First triangle first vertex
  assertEquals(indices[1], 1); // First triangle second vertex
  assertEquals(indices[2], 2); // First triangle third vertex

  // Test that bounding box was computed
  const boundingBox = geometry.boundingBox;
  assert(boundingBox !== null, "Bounding box should be computed");
  assertEquals(boundingBox!.min.x, -1);
  assertEquals(boundingBox!.min.y, -1);
  assertEquals(boundingBox!.min.z, -1);
  assertEquals(boundingBox!.max.x, 1);
  assertEquals(boundingBox!.max.y, 1);
  assertEquals(boundingBox!.max.z, 1);

  // Test that bounding sphere was computed
  const boundingSphere = geometry.boundingSphere;
  assert(boundingSphere !== null, "Bounding sphere should be computed");
  assertEquals(boundingSphere!.radius, Math.sqrt(3)); // Diagonal of unit cube
  assertEquals(boundingSphere!.center.x, 0);
  assertEquals(boundingSphere!.center.y, 0);
  assertEquals(boundingSphere!.center.z, 0);

  // Clean up
  geometry.dispose();
}

export function TestSetGeometryFromOBJEdgeCases() {
  // Test 1: Empty model (no vertices)
  const emptyModel = {
    name: "empty_model",
    vertices: new Float32Array([]),
    indices: new Uint16Array([]),
  };

  const emptyGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(emptyModel, emptyGeometry);

  const emptyPositionAttribute = emptyGeometry.getAttribute("position");
  assertEquals(emptyPositionAttribute.count, 0);
  assertEquals(emptyPositionAttribute.itemSize, 3);

  const emptyIndexAttribute = emptyGeometry.getIndex();
  assert(
    emptyIndexAttribute !== null,
    "Index attribute should be set even for empty model"
  );
  assertEquals(emptyIndexAttribute!.count, 0);

  // Clean up
  emptyGeometry.dispose();

  // Test 2: Single vertex (degenerate case)
  const singleVertexModel = {
    name: "single_vertex",
    vertices: new Float32Array([0, 0, 0]),
    indices: new Uint16Array([]),
  };

  const singleVertexGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(singleVertexModel, singleVertexGeometry);

  const singlePositionAttribute = singleVertexGeometry.getAttribute("position");
  assertEquals(singlePositionAttribute.count, 1);
  assertEquals(singlePositionAttribute.itemSize, 3);

  const singleVertices = singlePositionAttribute.array as Float32Array;
  assertEquals(singleVertices[0], 0);
  assertEquals(singleVertices[1], 0);
  assertEquals(singleVertices[2], 0);

  // Clean up
  singleVertexGeometry.dispose();

  // Test 3: Model with indices but no vertices (malformed data)
  const malformedModel = {
    name: "malformed_model",
    vertices: new Float32Array([]),
    indices: new Uint16Array([0, 1, 2]),
  };

  const malformedGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(malformedModel, malformedGeometry);

  const malformedPositionAttribute = malformedGeometry.getAttribute("position");
  assertEquals(malformedPositionAttribute.count, 0);
  assertEquals(malformedPositionAttribute.itemSize, 3);

  const malformedIndexAttribute = malformedGeometry.getIndex();
  assert(malformedIndexAttribute !== null, "Index attribute should be set");
  assertEquals(malformedIndexAttribute!.count, 3);

  // Clean up
  malformedGeometry.dispose();

  // Test 4: Very large model (stress test)
  const largeVertexCount = 10000;
  const largeVertices = new Float32Array(largeVertexCount * 3);
  const largeIndices = new Uint16Array(largeVertexCount * 3);

  // Fill with sequential data
  for (let i = 0; i < largeVertexCount; i++) {
    largeVertices[i * 3] = i; // x
    largeVertices[i * 3 + 1] = i + 1; // y
    largeVertices[i * 3 + 2] = i + 2; // z
  }

  for (let i = 0; i < largeVertexCount; i++) {
    largeIndices[i] = i;
  }

  const largeModel = {
    name: "large_model",
    vertices: largeVertices,
    indices: largeIndices,
  };

  const largeGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(largeModel, largeGeometry);

  const largePositionAttribute = largeGeometry.getAttribute("position");
  assertEquals(largePositionAttribute.count, largeVertexCount);
  assertEquals(largePositionAttribute.itemSize, 3);

  const largeIndexAttribute = largeGeometry.getIndex();
  assert(largeIndexAttribute !== null, "Index attribute should be set");
  assertEquals(largeIndexAttribute!.count, largeVertexCount * 3);

  // Clean up
  largeGeometry.dispose();

  // Test 5: Model with extreme coordinates
  const extremeModel = {
    name: "extreme_coordinates",
    vertices: new Float32Array([
      -1e6,
      -1e6,
      -1e6, // Very negative
      1e6,
      1e6,
      1e6, // Very positive
      0,
      0,
      0, // Origin
    ]),
    indices: new Uint16Array([0, 1, 2]),
  };

  const extremeGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(extremeModel, extremeGeometry);

  const extremePositionAttribute = extremeGeometry.getAttribute("position");
  assertEquals(extremePositionAttribute.count, 3);
  assertEquals(extremePositionAttribute.itemSize, 3);

  const extremeVertices = extremePositionAttribute.array as Float32Array;
  assertEquals(extremeVertices[0], -1e6);
  assertEquals(extremeVertices[1], -1e6);
  assertEquals(extremeVertices[2], -1e6);
  assertEquals(extremeVertices[3], 1e6);
  assertEquals(extremeVertices[4], 1e6);
  assertEquals(extremeVertices[5], 1e6);

  // Clean up
  extremeGeometry.dispose();

  // Test 6: Model with floating point precision edge cases
  const precisionModel = {
    name: "precision_test",
    vertices: new Float32Array([
      Number.MIN_VALUE,
      Number.MAX_VALUE,
      0,
      -Number.MIN_VALUE,
      -Number.MAX_VALUE,
      0,
      0.1 + 0.2,
      0.3 - 0.1,
      Math.PI,
    ]),
    indices: new Uint16Array([0, 1, 2]),
  };

  const precisionGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(precisionModel, precisionGeometry);

  const precisionPositionAttribute = precisionGeometry.getAttribute("position");
  assertEquals(precisionPositionAttribute.count, 3);
  assertEquals(precisionPositionAttribute.itemSize, 3);

  // Clean up
  precisionGeometry.dispose();

  // Test 7: Model with duplicate vertices
  const duplicateModel = {
    name: "duplicate_vertices",
    vertices: new Float32Array([
      0,
      0,
      0, // Vertex 0
      1,
      1,
      1, // Vertex 1
      0,
      0,
      0, // Vertex 2 (duplicate of 0)
      1,
      1,
      1, // Vertex 3 (duplicate of 1)
    ]),
    indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
  };

  const duplicateGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(duplicateModel, duplicateGeometry);

  const duplicatePositionAttribute = duplicateGeometry.getAttribute("position");
  assertEquals(duplicatePositionAttribute.count, 4);
  assertEquals(duplicatePositionAttribute.itemSize, 3);

  const duplicateVertices = duplicatePositionAttribute.array as Float32Array;
  assertEquals(duplicateVertices[0], 0); // First vertex
  assertEquals(duplicateVertices[3], 1); // Second vertex
  assertEquals(duplicateVertices[6], 0); // Third vertex (duplicate)
  assertEquals(duplicateVertices[9], 1); // Fourth vertex (duplicate)

  // Clean up
  duplicateGeometry.dispose();

  // Test 8: Model with zero-area triangles (degenerate triangles)
  const degenerateModel = {
    name: "degenerate_triangles",
    vertices: new Float32Array([
      0,
      0,
      0, // Vertex 0
      1,
      0,
      0, // Vertex 1
      0,
      0,
      0, // Vertex 2 (same as 0 - creates zero-area triangle)
    ]),
    indices: new Uint16Array([0, 1, 2]),
  };

  const degenerateGeometry = new THREE.BufferGeometry();
  SetGeometryFromOBJ(degenerateModel, degenerateGeometry);

  const degeneratePositionAttribute =
    degenerateGeometry.getAttribute("position");
  assertEquals(degeneratePositionAttribute.count, 3);
  assertEquals(degeneratePositionAttribute.itemSize, 3);

  const degenerateIndexAttribute = degenerateGeometry.getIndex();
  assert(degenerateIndexAttribute !== null, "Index attribute should be set");
  assertEquals(degenerateIndexAttribute!.count, 3);

  const degenerateIndices = degenerateIndexAttribute!.array as Uint16Array;
  assertEquals(degenerateIndices[0], 0);
  assertEquals(degenerateIndices[1], 1);
  assertEquals(degenerateIndices[2], 2);

  // Clean up
  degenerateGeometry.dispose();
}
