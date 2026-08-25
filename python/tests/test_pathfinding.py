from dsc.spatial.pathfinding import PathFindData, get_route_distance


def test_get_route_distance_basic():
    straight = [
        {"x": 0, "y": 0, "z": 0},
        {"x": 1, "y": 0, "z": 0},
        {"x": 2, "y": 0, "z": 0},
        {"x": 3, "y": 0, "z": 0},
    ]
    assert abs(get_route_distance(straight) - 3) < 0.0001

    multi = [
        {"x": 0, "y": 0, "z": 0},
        {"x": 3, "y": 0, "z": 0},
        {"x": 3, "y": 4, "z": 0},
        {"x": 0, "y": 4, "z": 0},
    ]
    assert abs(get_route_distance(multi) - 10) < 0.0001
    assert get_route_distance([{"x": 5, "y": 10, "z": 15}]) == 0
    three_d = [
        {"x": 0, "y": 0, "z": 0},
        {"x": 1, "y": 1, "z": 1},
        {"x": 2, "y": 2, "z": 2},
    ]
    assert abs(get_route_distance(three_d) - 2 * (3**0.5)) < 0.0001
    assert get_route_distance([]) == 0


def test_path_find_data_basic():
    data = PathFindData()
    start = {
        "adjusted": {"x": 0, "y": 0, "z": 0},
        "original": {"x": 0, "y": 0, "z": 0},
        "isOffMesh": False,
    }
    end = {
        "adjusted": {"x": 1, "y": 0, "z": 0},
        "original": {"x": 1, "y": 0, "z": 0},
        "isOffMesh": False,
    }
    data.add_path_segment(
        start,
        end,
        [{"x": 0, "y": 0, "z": 0}, {"x": 0.5, "y": 0, "z": 0}, {"x": 1, "y": 0, "z": 0}],
        1.0,
        0,
    )
    assert len(data.path) == 3
    assert len(data.paths) == 1
    assert data.distances[0] == 1.0

    start2 = {
        "adjusted": {"x": 1, "y": 0, "z": 0},
        "original": {"x": 1, "y": 0, "z": 0},
        "isOffMesh": False,
    }
    end2 = {
        "adjusted": {"x": 2, "y": 0, "z": 0},
        "original": {"x": 2, "y": 0, "z": 0},
        "isOffMesh": False,
    }
    data.add_path_segment(
        start2,
        end2,
        [{"x": 1, "y": 0, "z": 0}, {"x": 1.5, "y": 0, "z": 0}, {"x": 2, "y": 0, "z": 0}],
        1.0,
        1,
    )
    assert len(data.path) == 5
    assert len(data.paths) == 2

    off_start = {
        "adjusted": {"x": 3, "y": 0, "z": 0},
        "original": {"x": 2.8, "y": 0.2, "z": 0},
        "isOffMesh": True,
    }
    off_end = {
        "adjusted": {"x": 4, "y": 0, "z": 0},
        "original": {"x": 4.2, "y": 0.2, "z": 0},
        "isOffMesh": True,
    }
    data.add_path_segment(
        off_start, off_end, [{"x": 3, "y": 0, "z": 0}, {"x": 4, "y": 0, "z": 0}], 1.5, 2
    )
    assert data.paths[2]["hasOffMeshStart"] is True
    assert data.paths[2]["hasOffMeshEnd"] is True
    assert len(data.paths[2]["points"]) == 4

    body = PathFindData()
    body.add_path_segment(start, end, [{"x": 0, "y": 0, "z": 0}, {"x": 1, "y": 0, "z": 0}], 2.5, 0)
    body.add_path_segment(start, end, [{"x": 0, "y": 0, "z": 0}, {"x": 1, "y": 0, "z": 0}], 3.5, 1)
    payload = body.to_body()
    assert payload["totalDistance"] == 6.0
    assert payload["segmentsDistances"] == [2.5, 3.5]


def test_path_find_data_empty():
    empty = PathFindData().to_body()
    assert empty["full"] == []
    assert empty["segments"] == []
    assert empty["totalDistance"] == 0
    assert empty["segmentsDistances"] == []
