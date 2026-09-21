from dsc.spatial.navmesh import clear_bake_cache, load_navmesh_from_obj


# Input floor alone: 4 verts, 2 triangles (CW in OBJ; baker flips to walkable).
FLOOR_ONLY_OBJ = """
o Floor
v -5.0 0.0 -5.0
v 5.0 0.0 -5.0
v 5.0 0.0 5.0
v -5.0 0.0 5.0
f 1 2 3
f 1 3 4
"""


def setup_function() -> None:
    clear_bake_cache()


def test_bake_produces_different_polygonization():
    query = load_navmesh_from_obj(FLOOR_ONLY_OBJ, radius=0)
    # Input is 4 verts / 2 tris; baker should emit a Recast poly mesh, not the raw faces.
    assert len(query.baked_vertices) > 0
    assert len(query.baked_polygons) > 0
    input_face_count = 2
    input_vert_count = 4
    assert (
        len(query.baked_polygons) != input_face_count
        or len(query.baked_vertices) != input_vert_count
        or any(len(p) != 3 for p in query.baked_polygons)
    )


def test_bake_path_across_floor():
    query = load_navmesh_from_obj(FLOOR_ONLY_OBJ, radius=0)
    start = {"x": -3.0, "y": 0.0, "z": -3.0}
    end = {"x": 3.0, "y": 0.0, "z": 3.0}
    result = query.compute_path(start, end)
    assert result["success"] is True
    assert len(result["path"]) >= 2
    assert abs(result["path"][0]["x"] - start["x"]) < 0.5
    assert abs(result["path"][-1]["x"] - end["x"]) < 0.5


def test_larger_agent_radius_erodes_walkable_area():
    near_edge = {"x": 4.7, "y": 0.0, "z": 0.0}

    thin = load_navmesh_from_obj(FLOOR_ONLY_OBJ, radius=0)
    fat = load_navmesh_from_obj(FLOOR_ONLY_OBJ, radius=1.0)

    thin_snap = thin.find_closest_point(near_edge)
    fat_snap = fat.find_closest_point(near_edge)

    # Zero-radius bake keeps the edge walkable; larger radius erodes it inward.
    assert thin_snap["isPointOverPoly"] is True
    assert abs(thin_snap["point"]["x"] - near_edge["x"]) < 0.5

    # Either off-mesh, or snapped farther from the boundary than the thin bake.
    eroded = (not fat_snap["isPointOverPoly"]) or (
        abs(fat_snap["point"]["x"]) < abs(thin_snap["point"]["x"]) - 0.2
    )
    assert eroded


def test_bake_cache_reuses_query():
    a = load_navmesh_from_obj(FLOOR_ONLY_OBJ, radius=0)
    b = load_navmesh_from_obj(FLOOR_ONLY_OBJ, radius=0)
    assert a is b
    c = load_navmesh_from_obj(FLOOR_ONLY_OBJ, radius=0.5)
    assert c is not a
