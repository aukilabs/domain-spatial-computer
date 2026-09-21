from __future__ import annotations

from typing import Any

import numpy as np

from dsc.cache import (
    NAVMESH,
    OCCLUSION,
    clear_cache,
    get_domain_asset,
    start_domain_watcher,
    stop_domain_watcher,
)
from dsc.spatial.cross_section import render_cross_section
from dsc.spatial.navmesh import (
    NavMeshQuery,
    compute_path,
    get_on_mesh_points,
    load_navmesh_from_obj,
)
from dsc.spatial.pathfinding import PathFindData, get_route_distance
from dsc.spatial.raycast import raycast_meshes
from dsc.types import Vector3


def _require_domain_id(domain_id: str | None) -> str:
    if not domain_id:
        raise ValueError("Missing domain id")
    return domain_id


def _load_navmesh(
    domain_id: str, refresh: bool, radius: float | None = None
) -> NavMeshQuery:
    try:
        obj_text = get_domain_asset(domain_id, NAVMESH[0], NAVMESH[1], refresh=refresh)
        return load_navmesh_from_obj(obj_text, radius=radius)
    except Exception as error:
        if str(error) == "failed to load navmesh":
            raise
        raise RuntimeError("failed to load navmesh") from error


def _load_occlusion(domain_id: str, refresh: bool) -> str:
    return get_domain_asset(domain_id, OCCLUSION[0], OCCLUSION[1], refresh=refresh)


def find_path(
    domain_id: str | None = None,
    way_points: list[Vector3] | None = None,
    radius: float | None = None,
    refresh: bool = False,
) -> dict[str, Any]:
    domain_id = _require_domain_id(domain_id)
    if not way_points:
        raise ValueError("Missing waypoints")
    if len(way_points) < 2:
        raise ValueError("Not enough waypoints")

    query = _load_navmesh(domain_id, refresh, radius=radius)
    on_mesh_points = get_on_mesh_points(query, way_points)
    result = PathFindData()
    for i in range(len(on_mesh_points) - 1):
        start = on_mesh_points[i]
        end = on_mesh_points[i + 1]
        path_result = compute_path(query, start, end)
        if path_result.get("success"):
            distance = get_route_distance(path_result["path"])
            result.add_path_segment(start, end, path_result["path"], distance, i)
    return {**result.to_body(), "waypoints": on_mesh_points}


def find_optimized_path(
    domain_id: str | None = None,
    way_points: list[Vector3] | None = None,
    radius: float | None = None,
    fixed_end: bool | None = None,
    refresh: bool = False,
) -> dict[str, Any]:
    domain_id = _require_domain_id(domain_id)
    if not way_points:
        raise ValueError("Missing waypoints")
    if len(way_points) < 2:
        raise ValueError("Not enough waypoints")

    query = _load_navmesh(domain_id, refresh, radius=radius)
    on_mesh_waypoints = get_on_mesh_points(query, way_points)
    result = PathFindData()

    unvisited = list(on_mesh_waypoints)
    start = unvisited.pop(0)
    end = unvisited.pop() if fixed_end else None
    optimal_route = [start]
    optimal_indices = [0]
    current = start
    i = 0

    while unvisited:
        nearest_idx = 0
        shortest = float("inf")
        nearest_path: dict[str, Any] | None = None
        for idx, dest in enumerate(unvisited):
            path_result = compute_path(query, current, dest)
            distance = get_route_distance(path_result.get("path") or [])
            if distance < shortest:
                shortest = distance
                nearest_idx = idx
                nearest_path = path_result
        nearest = unvisited.pop(nearest_idx)
        optimal_route.append(nearest)
        optimal_indices.append(on_mesh_waypoints.index(nearest))
        result.add_path_segment(
            start, nearest, (nearest_path or {}).get("path") or [], shortest, i
        )
        current = nearest
        i += 1

    if end is not None:
        path_to_end = compute_path(query, current, end)
        distance = get_route_distance(path_to_end.get("path") or [])
        optimal_route.append(end)
        optimal_indices.append(on_mesh_waypoints.index(end))
        result.add_path_segment(start, end, path_to_end.get("path") or [], distance, i)

    return {
        **result.to_body(),
        "waypoints": optimal_route,
        "waypointIndices": optimal_indices,
    }


def restrict_to_navmesh(
    domain_id: str | None = None,
    target: Vector3 | None = None,
    radius: float | None = None,
    refresh: bool = False,
) -> dict[str, Any]:
    domain_id = _require_domain_id(domain_id)
    if not target:
        raise ValueError("Missing target")

    # Match Deno: bake with walkableRadius 0; radius is min snap distance after.
    query = _load_navmesh(domain_id, refresh, radius=0)
    closest = query.find_closest_point(target, (100, 10, 100))
    restricted = dict(closest["point"])
    direction = np.array(
        [
            target["x"] - restricted["x"],
            target["y"] - restricted["y"],
            target["z"] - restricted["z"],
        ],
        dtype=float,
    )
    length = float(np.linalg.norm(direction))
    if length > 0:
        direction = direction / length
    else:
        direction = np.zeros(3)

    min_distance = radius if radius is not None else 0
    distance = float(
        np.linalg.norm(
            [
                restricted["x"] - target["x"],
                restricted["y"] - target["y"],
                restricted["z"] - target["z"],
            ]
        )
    )
    if distance < min_distance:
        move = min_distance - distance
        restricted["x"] -= float(direction[0] * move)
        restricted["y"] -= float(direction[1] * move)
        restricted["z"] -= float(direction[2] * move)

    return {
        "original": target,
        "restricted": restricted,
        "direction": {
            "x": float(direction[0]),
            "y": float(direction[1]),
            "z": float(direction[2]),
        },
    }


def raycast(
    domain_id: str | None = None,
    ray: Any = None,
    refresh: bool = False,
) -> dict[str, Any]:
    domain_id = _require_domain_id(domain_id)
    if ray is None:
        raise ValueError("Missing refinement id")
    obj_text = _load_occlusion(domain_id, refresh)
    hits = raycast_meshes(obj_text, ray)
    return {"message": "Success", "data": {"hits": hits}}


def cross_section(
    domain_id: str | None = None,
    height: float | None = None,
    file_type: str | None = None,
    pixels_per_meter: float | None = None,
    include_origin: bool | None = None,
    line_thickness: float | None = None,
    line_color: str | None = None,
    show_axes: bool | None = None,
    x_axis_color: str | None = None,
    y_axis_color: str | None = None,
    origin_color: str | None = None,
    buffer: float | None = None,
    refresh: bool = False,
) -> dict[str, Any]:
    domain_id = _require_domain_id(domain_id)
    if height is None:
        raise ValueError("Missing height")
    if file_type is None:
        raise ValueError("Missing file type")
    if file_type not in {"png", "stcm", "bmp"}:
        raise ValueError("Invalid file type")
    obj_text = _load_occlusion(domain_id, refresh)
    try:
        return render_cross_section(
            obj_text,
            height=height,
            file_type=file_type,
            pixels_per_meter=pixels_per_meter,
            include_origin=include_origin,
            line_thickness=line_thickness,
            line_color=line_color,
            show_axes=show_axes,
            x_axis_color=x_axis_color,
            y_axis_color=y_axis_color,
            origin_color=origin_color,
            buffer=buffer,
        )
    except RuntimeError as error:
        raise RuntimeError(str(error)) from error
