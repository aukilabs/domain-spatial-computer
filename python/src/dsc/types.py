from __future__ import annotations

from typing import TypedDict


class Vector3(TypedDict):
    x: float
    y: float
    z: float


class Quaternion(TypedDict):
    x: float
    y: float
    z: float
    w: float


class Pose(TypedDict):
    position: Vector3
    rotation: Quaternion


class FlatPose(TypedDict):
    px: float
    py: float
    pz: float
    rx: float
    ry: float
    rz: float
    rw: float


class OnMeshPoint(TypedDict):
    adjusted: Vector3
    original: Vector3
    isOffMesh: bool


class PathSegment(TypedDict):
    points: list[Vector3]
    hasOffMeshStart: bool
    hasOffMeshEnd: bool


class Metadata(TypedDict):
    id: str
    domain_id: str
    created_at: str
    updated_at: str
    link: str
    name: str
    data_type: str
