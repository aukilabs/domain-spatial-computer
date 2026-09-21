from __future__ import annotations

from heapq import heappop, heappush
from typing import Any

import numpy as np
import trimesh
from pathfinder.navmesh import Navmesh
from pathfinder.navmesh_baker import NavmeshBaker

from dsc.parse.obj import ParsedOBJModel, parse_obj_string
from dsc.types import OnMeshPoint, Vector3

Vec = dict[str, float]

_bake_cache: dict[tuple[int, float], NavMeshQuery] = {}


def vec(x: float, y: float, z: float) -> Vector3:
    return {"x": float(x), "y": float(y), "z": float(z)}


def as_array(point: Vector3 | Vec) -> np.ndarray:
    return np.array([point["x"], point["y"], point["z"]], dtype=float)


def _triangle_normal_y(
    vertices: list[tuple[float, float, float]], a: int, b: int, c: int
) -> float:
    ax, ay, az = vertices[a]
    bx, by, bz = vertices[b]
    cx, cy, cz = vertices[c]
    ux, uz = bx - ax, bz - az
    vx, vz = cx - ax, cz - az
    return uz * vx - ux * vz


def _model_geometry(
    model: ParsedOBJModel,
) -> tuple[list[tuple[float, float, float]], list[list[int]]] | None:
    if not model.vertices or not model.indices:
        return None
    vertices = [
        (float(model.vertices[i]), float(model.vertices[i + 1]), float(model.vertices[i + 2]))
        for i in range(0, len(model.vertices), 3)
    ]
    indices = list(model.indices)
    polygons: list[list[int]] = []
    i = 0
    while i + 2 < len(indices):
        a, b, c = indices[i], indices[i + 1], indices[i + 2]
        # Recast only marks upward-facing tris walkable; flip downward faces.
        if _triangle_normal_y(vertices, a, b, c) < 0:
            polygons.append([a, c, b])
        else:
            polygons.append([a, b, c])
        i += 3
    if not polygons:
        return None
    return vertices, polygons


def _polygons_to_trimesh(
    vertices: list[tuple[float, float, float]], polygons: list[list[int]]
) -> trimesh.Trimesh:
    faces: list[list[int]] = []
    for polygon in polygons:
        if len(polygon) < 3:
            continue
        for i in range(1, len(polygon) - 1):
            faces.append([polygon[0], polygon[i], polygon[i + 1]])
    if not faces:
        raise RuntimeError("failed to load navmesh")
    return trimesh.Trimesh(
        vertices=np.array(vertices, dtype=float),
        faces=np.array(faces, dtype=np.int64),
        process=False,
    )


def _bake_navmesh(
    models: list[ParsedOBJModel], agent_radius: float
) -> tuple[list[tuple[float, float, float]], list[list[int]]]:
    baker = NavmeshBaker()
    added = False
    for model in models:
        geometry = _model_geometry(model)
        if geometry is None:
            continue
        vertices, polygons = geometry
        baker.add_geometry(vertices, polygons)
        added = True
    if not added:
        raise RuntimeError("failed to load navmesh")

    # pynavmesh crashes (ZeroDivisionError) when agent_radius == 0.
    bake_radius = agent_radius if agent_radius > 0 else 1e-6

    try:
        ok = baker.bake(
            cell_size=0.05,
            cell_height=0.01,
            agent_radius=bake_radius,
            edge_max_error=0.5,
            edge_max_len=30.0,
            detail_sample_distance=2.0,
            detail_sample_maximum_error=0.5,
            region_min_size=2,
            region_merge_size=3,
        )
    except ZeroDivisionError as error:
        raise RuntimeError("failed to load navmesh") from error
    if not ok:
        raise RuntimeError("failed to load navmesh")

    vertices, polygons = baker.get_polygonization()
    if not vertices or not polygons:
        raise RuntimeError("failed to load navmesh")
    return vertices, polygons


class NavMeshQuery:
    def __init__(
        self,
        navmesh: Navmesh,
        mesh: trimesh.Trimesh,
        *,
        baked_vertices: list[tuple[float, float, float]] | None = None,
        baked_polygons: list[list[int]] | None = None,
    ) -> None:
        self._pynav = navmesh
        self.mesh = mesh
        self.baked_vertices = baked_vertices or []
        self.baked_polygons = baked_polygons or []
        self._adjacency = _vertex_adjacency(mesh)

    def find_closest_point(
        self, point: Vector3, half_extents: tuple[float, float, float] = (100, 10, 100)
    ) -> dict[str, Any]:
        query = as_array(point)
        snapped: np.ndarray | None = None
        snapped_raw = self._pynav.sample(
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
        try:
            raw = self._pynav.search_path(
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


def load_navmesh_from_obj(obj_text: str, radius: float | None = None) -> NavMeshQuery:
    agent_radius = float(radius or 0)
    cache_key = (hash(obj_text), agent_radius)
    cached = _bake_cache.get(cache_key)
    if cached is not None:
        return cached

    models = parse_obj_string(obj_text)
    vertices, polygons = _bake_navmesh(models, agent_radius)
    mesh = _polygons_to_trimesh(vertices, polygons)
    navmesh = Navmesh(vertices, polygons)
    query = NavMeshQuery(
        navmesh,
        mesh,
        baked_vertices=vertices,
        baked_polygons=polygons,
    )
    _bake_cache[cache_key] = query
    return query


def clear_bake_cache() -> None:
    _bake_cache.clear()


def get_on_mesh_points(
    query: NavMeshQuery, points: list[Vector3], radius: float | None = None
) -> list[OnMeshPoint]:
    del radius
    half_extents = (100.0, 10.0, 100.0)
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
