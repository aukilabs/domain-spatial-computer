from __future__ import annotations

from typing import Any

import numpy as np
from PIL import Image

from dsc.parse.bitmap import Bitmap
from dsc.parse.bmp import encode_bmp
from dsc.parse.obj import parse_obj_string
from dsc.spatial.raycast import models_to_named_meshes
from dsc.stcm import create_stcm


def hex2rgb(hex_color: str) -> int:
    red = int(hex_color[1:3], 16)
    green = int(hex_color[3:5], 16)
    blue = int(hex_color[5:7], 16)
    return (1 << 24) | (red << 16) | (green << 8) | blue


def _intersect_segment_plane(
    start: np.ndarray, end: np.ndarray, height: float
) -> np.ndarray | None:
    # THREE.Plane(normal=(0,-1,0), constant=height): -y + height = 0
    direction = end - start
    denominator = -direction[1]
    if abs(denominator) < 1e-20:
        if abs(-start[1] + height) < 1e-12:
            return start.copy()
        return None
    t = -(-start[1] + height) / denominator
    if t < 0 or t > 1:
        return None
    return start + t * direction


def _almost_equal(a: np.ndarray, b: np.ndarray) -> bool:
    return bool(np.allclose(a, b, atol=1e-6, rtol=0))


def _clip_mesh_at_height(mesh, height: float) -> tuple[list[np.ndarray], Any]:
    segments: list[np.ndarray] = []
    triangles = mesh.triangles
    for tri in triangles:
        points: list[np.ndarray] = []
        edges = ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0]))
        for start, end in edges:
            hit = _intersect_segment_plane(np.asarray(start), np.asarray(end), height)
            if hit is not None:
                points.append(hit)
        if len(points) == 3:
            if _almost_equal(points[2], points[0]) or _almost_equal(points[2], points[1]):
                points.pop()
            elif _almost_equal(points[0], points[1]):
                points[1] = points[2]
                points.pop()
        if len(points) == 2:
            segments.append(points[0])
            segments.append(points[1])
    bounds = mesh.bounds
    return segments, bounds


def _draw_line_on_image(
    start: np.ndarray,
    end: np.ndarray,
    offset: np.ndarray,
    ppm: float,
    color: int,
    thickness: float,
    bitmap: Bitmap,
) -> None:
    start_offset = (start - offset) * ppm
    end_offset = (end - offset) * ppm
    distance = float(np.linalg.norm(end_offset - start_offset))
    if distance == 0:
        return
    for i in range(int(distance)):
        t = i / distance
        point = start_offset * (1 - t) + end_offset * t
        x = int(np.floor(point[0]))
        y = int(np.floor(point[1]))
        bitmap.draw_line(
            x - thickness / 2, y - thickness / 2, thickness, thickness, color
        )


def render_cross_section(
    obj_text: str,
    height: float,
    file_type: str,
    pixels_per_meter: float | None = None,
    include_origin: bool | None = None,
    line_thickness: float | None = None,
    line_color: str | None = None,
    show_axes: bool | None = None,
    x_axis_color: str | None = None,
    y_axis_color: str | None = None,
    origin_color: str | None = None,
    buffer: float | None = None,
) -> dict[str, Any]:
    del include_origin  # accepted but unused, matching Deno
    show = bool(show_axes)
    ppm = max(1, min(pixels_per_meter if pixels_per_meter is not None else 20, 200))
    x_color = hex2rgb(x_axis_color) if x_axis_color else 0xFF0000
    y_color = hex2rgb(y_axis_color) if y_axis_color else 0x00FF00
    o_color = hex2rgb(origin_color) if origin_color else 0xFFFF00
    l_color = hex2rgb(line_color) if line_color else 0x000000
    thickness = line_thickness if line_thickness is not None else 1
    img_buffer = buffer if buffer is not None else 0

    meshes = models_to_named_meshes(parse_obj_string(obj_text))
    all_segments: list[tuple[np.ndarray, np.ndarray]] = []
    min_x = float("inf")
    max_x = float("-inf")
    min_y = float("inf")
    max_y = float("-inf")

    for _name, mesh in meshes:
        segments, bounds = _clip_mesh_at_height(mesh, height)
        min_x = min(min_x, float(bounds[0][0]), float(bounds[1][0]))
        max_x = max(max_x, float(bounds[0][0]), float(bounds[1][0]))
        min_y = min(min_y, float(bounds[0][2]), float(bounds[1][2]))
        max_y = max(max_y, float(bounds[0][2]), float(bounds[1][2]))
        for i in range(0, len(segments), 2):
            all_segments.append((segments[i], segments[i + 1]))

    min_x -= img_buffer
    min_y -= img_buffer
    max_x += img_buffer
    max_y += img_buffer

    size_x = max_x - min_x
    size_y = max_y - min_y
    offset = np.array([min_x, min_y], dtype=float)
    png_w = int(np.ceil(size_x * ppm))
    png_h = int(np.ceil(size_y * ppm))
    bitmap = Bitmap(png_w, png_h)

    if show:
        bitmap.draw_line(0, round(-offset[1] * ppm), png_w, 1, x_color)
        bitmap.draw_line(round(-offset[0] * ppm), 0, 1, png_h, y_color)
        bitmap.draw_line(
            round(-offset[0] * ppm), round(-offset[1] * ppm), 1, 1, o_color
        )

    for start3, end3 in all_segments:
        start2 = np.array([start3[0], start3[2]], dtype=float)
        end2 = np.array([end3[0], end3[2]], dtype=float)
        _draw_line_on_image(start2, end2, offset, ppm, l_color, thickness, bitmap)

    image_name = "bmp" if file_type == "stcm" else file_type
    yaml_lines = [
        "free_thresh: 0.196",
        "negate: 0",
        "occupied_thresh: 0.65",
        f"image: map.{image_name}",
        "origin: ",
        f"- {min_x:.3f}",
        f"- {(-max_y):.3f}",
        "- 0",
        f"resolution: {1 / ppm}",
    ]
    yaml_string = "\n".join(yaml_lines)

    if file_type == "png":
        image = Image.frombytes(
            "RGB", (bitmap.width, bitmap.height), bytes(bitmap.buffer)
        )
        from io import BytesIO

        buffer_io = BytesIO()
        image.save(buffer_io, format="PNG")
        return {"img": buffer_io.getvalue(), "yaml": yaml_string}

    bmp = encode_bmp(bitmap)
    if file_type == "bmp":
        return {"img": bmp, "yaml": yaml_string}
    if file_type == "stcm":
        return {"img": create_stcm(yaml_string, bmp), "yaml": yaml_string}
    raise ValueError("Invalid file type")
