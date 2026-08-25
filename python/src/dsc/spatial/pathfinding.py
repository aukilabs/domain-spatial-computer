from __future__ import annotations

from dsc.types import OnMeshPoint, Vector3


def get_route_distance(path: list[Vector3]) -> float:
    total = 0.0
    for i, point in enumerate(path):
        if i == 0:
            continue
        prev = path[i - 1]
        dx = point["x"] - prev["x"]
        dy = point["y"] - prev["y"]
        dz = point["z"] - prev["z"]
        total += (dx * dx + dy * dy + dz * dz) ** 0.5
    return total


class PathFindData:
    def __init__(self) -> None:
        self.path: list[Vector3] = []
        self.paths: list[dict] = []
        self.distances: list[float] = []

    def add_path_segment(
        self,
        start: OnMeshPoint,
        end: OnMeshPoint,
        path_result: list[Vector3],
        new_distance: float,
        index: int,
    ) -> None:
        segment_points: list[Vector3] = []
        if start["isOffMesh"]:
            segment_points.append(start["original"])
        segment_points.extend(path_result)
        if end["isOffMesh"]:
            segment_points.append(end["original"])

        if index == 0:
            self.path.extend(segment_points)
        else:
            self.path.extend(segment_points[1:])

        self.paths.append(
            {
                "points": segment_points,
                "hasOffMeshStart": start["isOffMesh"],
                "hasOffMeshEnd": end["isOffMesh"],
            }
        )
        self.distances.append(new_distance)

    def to_body(self) -> dict:
        return {
            "full": self.path,
            "segments": self.paths,
            "totalDistance": sum(self.distances),
            "segmentsDistances": self.distances,
        }
