from __future__ import annotations

from typing import Any

import numpy as np
import trimesh
from trimesh.transformations import quaternion_from_matrix, quaternion_matrix

from dsc.parse.obj import ParsedOBJModel, parse_obj_string
from dsc.types import Vector3


def models_to_named_meshes(
    models: list[ParsedOBJModel],
) -> list[tuple[str, trimesh.Trimesh]]:
    meshes: list[tuple[str, trimesh.Trimesh]] = []
    for model in models:
        if not model.vertices or not model.indices:
            continue
        vertices = np.array(model.vertices, dtype=float).reshape(-1, 3)
        indices = list(model.indices)
        faces: list[list[int]] = []
        i = 0
        while i + 2 < len(indices):
            faces.append([indices[i], indices[i + 1], indices[i + 2]])
            i += 3
        if not faces:
            continue
        mesh = trimesh.Trimesh(
            vertices=vertices, faces=np.array(faces, dtype=np.int64), process=False
        )
        meshes.append((model.name, mesh))
    return meshes


def _rotate_vector(quat_xyzw: tuple[float, float, float, float], vector: np.ndarray) -> np.ndarray:
    wxyz = [quat_xyzw[3], quat_xyzw[0], quat_xyzw[1], quat_xyzw[2]]
    matrix = quaternion_matrix(wxyz)
    rotated = matrix[:3, :3] @ vector
    norm = np.linalg.norm(rotated)
    if norm == 0:
        return vector
    return rotated / norm


def parse_ray(ray: Any) -> tuple[np.ndarray, np.ndarray]:
    origin = np.zeros(3, dtype=float)
    direction = np.array([0.0, 0.0, 1.0], dtype=float)
    if isinstance(ray, list):
        flat: list[float] = []
        for item in ray:
            if isinstance(item, list):
                flat.extend(item)
            else:
                flat.append(float(item))
        matrix = np.array(flat, dtype=float).reshape((4, 4), order="F").T
        origin = matrix[:3, 3].copy()
        quat = quaternion_from_matrix(matrix)
        direction = _rotate_vector(
            (float(quat[1]), float(quat[2]), float(quat[3]), float(quat[0])),
            direction,
        )
    elif isinstance(ray, dict) and "position" in ray:
        pos = ray["position"]
        origin = np.array([pos["x"], pos["y"], pos["z"]], dtype=float)
        rot = ray["rotation"]
        direction = _rotate_vector(
            (rot["x"], rot["y"], rot["z"], rot["w"]), direction
        )
    elif isinstance(ray, dict):
        origin = np.array([ray["px"], ray["py"], ray["pz"]], dtype=float)
        direction = _rotate_vector(
            (ray["rx"], ray["ry"], ray["rz"], ray["rw"]), direction
        )
    else:
        raise ValueError("Missing refinement id")
    return origin, direction


def raycast_meshes(
    obj_text: str, ray: Any
) -> list[dict[str, Any]]:
    origin, direction = parse_ray(ray)
    hits: list[dict[str, Any]] = []
    for name, mesh in models_to_named_meshes(parse_obj_string(obj_text)):
        intersector = mesh.ray
        locations, _index_ray, index_tri = intersector.intersects_location(
            ray_origins=[origin], ray_directions=[direction]
        )
        for location, tri_index in zip(locations, index_tri, strict=False):
            distance = float(np.linalg.norm(location - origin))
            normal = mesh.face_normals[int(tri_index)]
            hits.append(
                {
                    "point": {
                        "x": float(location[0]),
                        "y": float(location[1]),
                        "z": float(location[2]),
                    },
                    "distance": distance,
                    "normal": {
                        "x": float(normal[0]),
                        "y": float(normal[1]),
                        "z": float(normal[2]),
                    },
                    "faceIndex": int(tri_index),
                    "name": name,
                }
            )
    hits.sort(key=lambda hit: hit["distance"])
    return hits
