from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ParsedOBJModel:
    name: str
    vertices: list[float]
    indices: list[int]


class Error(Exception):
    pass


def parse_obj_string(data: str) -> list[ParsedOBJModel]:
    """Parse Wavefront OBJ text, matching the Deno parser semantics."""
    try:
        return _parse_obj_string(data)
    except Error:
        raise
    except Exception as error:
        raise Error(f"Failed to parse OBJ data: {error}") from error


def _parse_obj_string(data: str) -> list[ParsedOBJModel]:
    normalized = data.replace("g ", "o ")
    models: list[ParsedOBJModel] = []
    name = ""
    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    vertex_base = 0

    def flush() -> None:
        nonlocal name, vertices, faces, vertex_base
        if vertices:
            flat: list[float] = []
            for vertex in vertices:
                flat.extend(vertex)
            indices: list[int] = []
            for face in faces:
                for idx in face:
                    indices.append(idx - vertex_base - 1)
            models.append(ParsedOBJModel(name=name, vertices=flat, indices=indices))
        vertex_base += len(vertices)
        name = ""
        vertices = []
        faces = []

    for raw_line in normalized.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        kind = parts[0]
        if kind == "o":
            flush()
            name = parts[1] if len(parts) > 1 else ""
        elif kind == "v":
            if len(parts) < 4:
                raise ValueError("invalid vertex")
            vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
        elif kind == "f":
            if len(parts) < 2:
                raise ValueError("invalid face")
            face_indices: list[int] = []
            for token in parts[1:]:
                vertex_token = token.split("/")[0]
                try:
                    face_indices.append(int(vertex_token))
                except ValueError as exc:
                    raise ValueError("invalid face") from exc
            faces.append(face_indices)

    flush()
    return models
