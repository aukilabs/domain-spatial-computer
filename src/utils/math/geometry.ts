// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { ParsedOBJModel } from "../parse/objParser.ts";

export function SetGeometryFromOBJ(
  model: ParsedOBJModel,
  geometry: THREE.BufferGeometry
) {
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(model.vertices, 3)
  );
  geometry.setIndex(new THREE.BufferAttribute(model.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
