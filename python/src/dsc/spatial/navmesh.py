from __future__ import annotations

from heapq import heappop, heappush
from typing import Any

import numpy as np
import trimesh

from dsc.parse.obj import ParsedOBJModel, parse_obj_string
from dsc.types import OnMeshPoint, Vector3

Vec = dict[str, float]


def vec(x: float, y: float, z: float) -> Vector3:
    return {"x": float(x), "y": float(y), "z": float(z)}


def as_array(point: Vector3 | Vec) -> np.ndarray:
    return np.array([point["x"], point["y"], point["z"]], dtype=float)


def models_to_trimesh(models: list[ParsedOBJModel]) -> trimesh.Trimesh:
    parts: list[trimesh.Trimesh] = []
    for model in models:
        if not model.vertices:
            continue
        vertices = np.array(model.vertices, dtype=float).reshape(-1, 3)
        if not model.indices:
            continue
        indices = list(model.indices)
        faces: list[list[int]] = []
        i = 0
        while i + 2 < len(indices):
            faces.append([indices[i], indices[i + 1], indices[i + 2]])
            i += 3
        if not faces:
            continue
        parts.append(
            trimesh.Trimesh(
                vertices=vertices,
                faces=np.array(faces, dtype=np.int64),
                process=False,
            )
        )
    if not parts:
        raise RuntimeError("failed to load navmesh")
    if len(parts) == 1:
        return parts[0]
    return trimesh.util.concatenate(parts)


def _try_pynavmesh(mesh: trimesh.Trimesh):
    try:
        from pathfinder.navmesh import Navmesh
    except Exception:
        return None
    vertices = [tuple(float(c) for c in vertex) for vertex in mesh.vertices]
    polygons = [list(map(int, face)) for face in mesh.faces]
    try:
        return Navmesh(vertices, polygons)
    except Exception:
        return None


class NavMeshQuery:
    def __init__(self, mesh: trimesh.Trimesh) -> None:
        self.mesh = mesh
        self._pynav = _try_pynavmesh(mesh)
        self._adjacency = _vertex_adjacency(mesh)

    def find_closest_point(
        self, point: Vector3, half_extents: tuple[float, float, float] = (100, 10, 100)
    ) -> dict[str, Any]:
        query = as_array(point)
        snapped: np.ndarray | None = None
        if self._pynav is not None:
            sample = getattr(self._pynav, "sample", None)
            if callable(sample):
                snapped_raw = sample(
                    (float(point["x"]), float(point["y"]), float(point["z"])),
                    True,
                )
                if snapped_raw is not None:
                    snapped = np.array(snapped_raw, dtype=float)
        if snapped is None:
            closest, _distance, _face_id = trimesh.proximity.closest_point(
                self.mesh, query.reshape(1, 3)
            )
            snapped = closest[0]
        delta = np.abs(snapped - query)
        success = bool(
            delta[0] <= half_extents[0]
            and delta[1] <= half_extents[1]
            and delta[2] <= half_extents[2]
        )
        horizontal = float(np.linalg.norm(snapped[[0, 2]] - query[[0, 2]]))
        return {
            "success": success,
            "isPointOverPoly": success and horizontal < 0.25,
            "point": vec(float(snapped[0]), float(snapped[1]), float(snapped[2])),
        }

    def compute_path(
        self,
        start: Vector3,
        end: Vector3,
        half_extents: tuple[float, float, float] = (1000, 10, 1000),
        max_path_polys: int = 1024,
        max_straight_path_points: int = 1024,
    ) -> dict[str, Any]:
        del half_extents, max_path_polys
        if self._pynav is not None:
            search = getattr(self._pynav, "search_path", None)
            if callable(search):
                try:
                    raw = search(
                        (start["x"], start["y"], start["z"]),
                        (end["x"], end["y"], end["z"]),
                    )
                    path = _coerce_path(raw)
                    if path:
                        return {"success": True, "path": path[:max_straight_path_points]}
                    return {"success": False, "path": []}
                except Exception:
                    pass
        path = _astar_vertex_path(self.mesh, self._adjacency, start, end)
        if not path:
            return {"success": False, "path": []}
        return {"success": True, "path": path[:max_straight_path_points]}


def load_navmesh_from_obj(obj_text: str) -> NavMeshQuery:
    models = parse_obj_string(obj_text)
    mesh = models_to_trimesh(models)
    return NavMeshQuery(mesh)


def get_on_mesh_points(
    query: NavMeshQuery, points: list[Vector3], radius: float | None = None
) -> list[OnMeshPoint]:
    extent = max(100.0, float(radius or 0))
    half_extents = (extent, 10.0, extent)
    result: list[OnMeshPoint] = []
    for point in points:
        closest = query.find_closest_point(point, half_extents)
        result.append(
            {
                "adjusted": closest["point"],
                "original": point,
                "isOffMesh": (not closest["success"]) or (not closest["isPointOverPoly"]),
            }
        )
    return result


def compute_path(query: NavMeshQuery, start: OnMeshPoint, end: OnMeshPoint) -> dict[str, Any]:
    return query.compute_path(
        start["adjusted"],
        end["adjusted"],
        half_extents=(1000, 10, 1000),
        max_path_polys=1024,
        max_straight_path_points=1024,
    )


def _vertex_adjacency(mesh: trimesh.Trimesh) -> dict[int, set[int]]:
    adjacency: dict[int, set[int]] = {i: set() for i in range(len(mesh.vertices))}
    for face in mesh.faces:
        a, b, c = int(face[0]), int(face[1]), int(face[2])
        adjacency[a].update((b, c))
        adjacency[b].update((a, c))
        adjacency[c].update((a, b))
    return adjacency


def _nearest_vertex(mesh: trimesh.Trimesh, point: Vector3) -> int:
    coords = as_array(point)
    distances = np.linalg.norm(mesh.vertices - coords, axis=1)
    return int(np.argmin(distances))


def _astar_vertex_path(
    mesh: trimesh.Trimesh,
    adjacency: dict[int, set[int]],
    start: Vector3,
    end: Vector3,
) -> list[Vector3]:
    start_idx = _nearest_vertex(mesh, start)
    end_idx = _nearest_vertex(mesh, end)
    vertices = mesh.vertices

    def heuristic(i: int) -> float:
        return float(np.linalg.norm(vertices[i] - vertices[end_idx]))

    open_heap: list[tuple[float, int]] = [(heuristic(start_idx), start_idx)]
    came_from: dict[int, int] = {}
    g_score: dict[int, float] = {start_idx: 0.0}
    closed: set[int] = set()

    while open_heap:
        _, current = heappop(open_heap)
        if current in closed:
            continue
        if current == end_idx:
            indices = [current]
            while current in came_from:
                current = came_from[current]
                indices.append(current)
            indices.reverse()
            path = [start]
            for idx in indices:
                vertex = vertices[idx]
                path.append(vec(vertex[0], vertex[1], vertex[2]))
            path.append(end)
            return _dedupe_path(path)
        closed.add(current)
        for neighbor in adjacency[current]:
            tentative = g_score[current] + float(
                np.linalg.norm(vertices[neighbor] - vertices[current])
            )
            if tentative >= g_score.get(neighbor, float("inf")):
                continue
            came_from[neighbor] = current
            g_score[neighbor] = tentative
            heappush(open_heap, (tentative + heuristic(neighbor), neighbor))
    return []


def _dedupe_path(path: list[Vector3]) -> list[Vector3]:
    if not path:
        return path
    out = [path[0]]
    for point in path[1:]:
        prev = out[-1]
        if (
            abs(prev["x"] - point["x"]) > 1e-9
            or abs(prev["y"] - point["y"]) > 1e-9
            or abs(prev["z"] - point["z"]) > 1e-9
        ):
            out.append(point)
    return out


def _coerce_path(raw: Any) -> list[Vector3]:
    if raw is None:
        return []
    if isinstance(raw, np.ndarray):
        raw = raw.tolist()
    path: list[Vector3] = []
    if isinstance(raw, list) and raw and isinstance(raw[0], (int, float)):
        for i in range(0, len(raw) - 2, 3):
            path.append(vec(raw[i], raw[i + 1], raw[i + 2]))
        return path
    for item in raw:
        if isinstance(item, dict):
            path.append(vec(item["x"], item["y"], item["z"]))
        elif isinstance(item, (list, tuple)) and len(item) >= 3:
            path.append(vec(item[0], item[1], item[2]))
    return path
