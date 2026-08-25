from dsc.spatial.navmesh import compute_path, get_on_mesh_points


class MockQuery:
    def find_closest_point(self, point, half_extents=(100, 10, 100)):
        distance = (point["x"] ** 2 + point["y"] ** 2 + point["z"] ** 2) ** 0.5
        if distance > 10:
            return {
                "success": False,
                "isPointOverPoly": False,
                "point": {"x": 0, "y": 0, "z": 0},
            }
        return {
            "success": True,
            "isPointOverPoly": True,
            "point": {
                "x": point["x"] * 0.95,
                "y": point["y"] * 0.95,
                "z": point["z"] * 0.95,
            },
        }

    def compute_path(self, start, end, **kwargs):
        distance = (
            (end["x"] - start["x"]) ** 2
            + (end["y"] - start["y"]) ** 2
            + (end["z"] - start["z"]) ** 2
        ) ** 0.5
        if distance > 100:
            return {"success": False, "path": []}
        if distance < 0.001:
            return {"success": True, "path": [dict(start)]}
        count = max(2, int(-(-distance // 10)))
        path = []
        for i in range(count):
            t = i / (count - 1)
            path.append(
                {
                    "x": start["x"] + t * (end["x"] - start["x"]),
                    "y": start["y"] + t * (end["y"] - start["y"]),
                    "z": start["z"] + t * (end["z"] - start["z"]),
                }
            )
        return {"success": True, "path": path}


def test_get_on_mesh_points():
    query = MockQuery()
    result = get_on_mesh_points(
        query,
        [
            {"x": 1, "y": 1, "z": 1},
            {"x": 5, "y": 5, "z": 5},
            {"x": 15, "y": 15, "z": 15},
        ],
    )
    assert len(result) == 3
    assert result[0]["isOffMesh"] is False
    assert result[1]["isOffMesh"] is False
    assert result[2]["isOffMesh"] is True
    assert result[0]["original"]["x"] == 1
    assert abs(result[0]["adjusted"]["x"] - 0.95) < 0.0001
    assert result[2]["adjusted"]["x"] == 0
    assert get_on_mesh_points(query, []) == []


def test_compute_path():
    query = MockQuery()
    start = {
        "adjusted": {"x": 0, "y": 0, "z": 0},
        "original": {"x": 0, "y": 0, "z": 0},
        "isOffMesh": False,
    }
    end = {
        "adjusted": {"x": 10, "y": 0, "z": 0},
        "original": {"x": 10, "y": 0, "z": 0},
        "isOffMesh": False,
    }
    result = compute_path(query, start, end)
    assert result["success"] is True
    assert result["path"][0]["x"] == 0
    assert result["path"][-1]["x"] == 10

    same = {
        "adjusted": {"x": 5, "y": 5, "z": 5},
        "original": {"x": 5, "y": 5, "z": 5},
        "isOffMesh": False,
    }
    same_result = compute_path(query, same, same)
    assert same_result["success"] is True
    assert len(same_result["path"]) == 1

    far_end = {
        "adjusted": {"x": 200, "y": 200, "z": 200},
        "original": {"x": 200, "y": 200, "z": 200},
        "isOffMesh": False,
    }
    far = compute_path(query, start, far_end)
    assert far["success"] is False
    assert far["path"] == []
