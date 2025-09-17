import { assertEquals, assertThrows } from "jsr:@std/assert";
import { ParseOBJString } from "./objParser.ts";

Deno.test("ParseOBJString - basic OBJ parsing", () => {
  // Simple OBJ with a triangle
  const simpleOBJ = `
o Triangle
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
f 1 2 3
`;

  const result = ParseOBJString(simpleOBJ);

  // Should have one model
  assertEquals(result.length, 1);

  const model = result[0];
  assertEquals(model.name, "Triangle");

  // Check vertices (3 vertices * 3 components each = 9 floats)
  assertEquals(model.vertices.length, 9);
  assertEquals(Array.from(model.vertices), [
    0.0,
    0.0,
    0.0, // vertex 1
    1.0,
    0.0,
    0.0, // vertex 2
    0.5,
    1.0,
    0.0, // vertex 3
  ]);

  // Check indices (1 triangle = 3 indices)
  assertEquals(model.indices.length, 3);
  assertEquals(Array.from(model.indices), [0, 1, 2]);
});

Deno.test("ParseOBJString - complex OBJ parsing", () => {
  // Complex OBJ with textures, normals, and multiple objects
  const complexOBJ = `
# Complex OBJ with multiple features
o Quad
v -1.0 -1.0 0.0
v 1.0 -1.0 0.0
v 1.0 1.0 0.0
v -1.0 1.0 0.0
vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0
vn 0.0 0.0 1.0
f 1/1/1 2/2/1 3/3/1
f 1/1/1 3/3/1 4/4/1

o Triangle
v 0.0 2.0 0.0
v 1.0 2.0 0.0
v 0.5 3.0 0.0
f 5 6 7
`;

  const result = ParseOBJString(complexOBJ);

  // Should have two models
  assertEquals(result.length, 2);

  // Test first model (Quad)
  const quadModel = result[0];
  assertEquals(quadModel.name, "Quad");
  assertEquals(quadModel.vertices.length, 12); // 4 vertices * 3 components
  assertEquals(quadModel.indices.length, 6); // 2 triangles * 3 indices each

  // Verify quad vertices
  assertEquals(Array.from(quadModel.vertices), [
    -1.0,
    -1.0,
    0.0, // vertex 1
    1.0,
    -1.0,
    0.0, // vertex 2
    1.0,
    1.0,
    0.0, // vertex 3
    -1.0,
    1.0,
    0.0, // vertex 4
  ]);

  // Verify quad indices (two triangles)
  assertEquals(Array.from(quadModel.indices), [0, 1, 2, 0, 2, 3]);

  // Test second model (Triangle)
  const triangleModel = result[1];
  assertEquals(triangleModel.name, "Triangle");
  assertEquals(triangleModel.vertices.length, 9); // 3 vertices * 3 components
  assertEquals(triangleModel.indices.length, 3); // 1 triangle * 3 indices

  // Verify triangle vertices (indices should be adjusted for second model)
  assertEquals(Array.from(triangleModel.vertices), [
    0.0,
    2.0,
    0.0, // vertex 5 -> 0
    1.0,
    2.0,
    0.0, // vertex 6 -> 1
    0.5,
    3.0,
    0.0, // vertex 7 -> 2
  ]);

  // Verify triangle indices (should be 0-based for this model)
  assertEquals(Array.from(triangleModel.indices), [0, 1, 2]);
});

Deno.test("ParseOBJString - edge cases", () => {
  // Test empty OBJ string
  const emptyOBJ = "";
  const emptyResult = ParseOBJString(emptyOBJ);
  assertEquals(emptyResult.length, 0);

  // Test OBJ with only comments and whitespace
  const commentsOnlyOBJ = `
# This is just a comment
# Another comment

`;
  const commentsResult = ParseOBJString(commentsOnlyOBJ);
  assertEquals(commentsResult.length, 0);

  // Test OBJ with object but no vertices
  const noVerticesOBJ = `
o EmptyObject
# No vertices defined
`;
  const noVerticesResult = ParseOBJString(noVerticesOBJ);
  assertEquals(noVerticesResult.length, 0); // Should be filtered out by vertices.length > 0

  // Test OBJ with vertices but no faces
  const noFacesOBJ = `
o VerticesOnly
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
# No faces defined
`;
  const noFacesResult = ParseOBJString(noFacesOBJ);
  assertEquals(noFacesResult.length, 1);

  const noFacesModel = noFacesResult[0];
  assertEquals(noFacesModel.name, "VerticesOnly");
  assertEquals(noFacesModel.vertices.length, 9); // 3 vertices * 3 components
  assertEquals(noFacesModel.indices.length, 0); // No faces = no indices

  // Test OBJ with malformed lines (should throw parsing error)
  const malformedOBJ = `
o TestObject
v 0.0 0.0 0.0
f invalid face
`;

  assertThrows(
    () => ParseOBJString(malformedOBJ),
    Error,
    "Failed to parse OBJ data"
  );

  // Test OBJ with single vertex (edge case for indexing)
  const singleVertexOBJ = `
o SingleVertex
v 0.0 0.0 0.0
`;
  const singleVertexResult = ParseOBJString(singleVertexOBJ);
  assertEquals(singleVertexResult.length, 1);

  const singleVertexModel = singleVertexResult[0];
  assertEquals(singleVertexModel.vertices.length, 3);
  assertEquals(singleVertexModel.indices.length, 0);

  // Test multiple empty objects (should all be filtered out)
  const multipleEmptyOBJ = `
o Empty1
o Empty2
o Empty3
`;
  const multipleEmptyResult = ParseOBJString(multipleEmptyOBJ);
  assertEquals(multipleEmptyResult.length, 0);

  // Test very large coordinates (numerical edge cases)
  const largeNumbersOBJ = `
o LargeNumbers
v 999999.999 -999999.999 0.0
v 0.000001 0.000001 999999.999
f 1 2 1
`;
  const largeNumbersResult = ParseOBJString(largeNumbersOBJ);
  assertEquals(largeNumbersResult.length, 1);

  const largeNumbersModel = largeNumbersResult[0];
  assertEquals(largeNumbersModel.vertices.length, 6);

  // Just verify the structure is correct, not exact floating point values
  const vertices = Array.from(largeNumbersModel.vertices);
  assertEquals(vertices[0] > 999999, true); // First vertex x is large positive
  assertEquals(vertices[1] < -999999, true); // First vertex y is large negative
  assertEquals(vertices[2], 0.0); // First vertex z is zero
  assertEquals(vertices[3] > 0, true); // Second vertex x is small positive
  assertEquals(vertices[4] > 0, true); // Second vertex y is small positive
  assertEquals(vertices[5] > 999999, true); // Second vertex z is large positive
});
