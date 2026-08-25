import pytest

from dsc.parse.obj import Error, parse_obj_string


def test_basic_obj_parsing():
    simple_obj = """
o Triangle
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
f 1 2 3
"""
    result = parse_obj_string(simple_obj)
    assert len(result) == 1
    model = result[0]
    assert model.name == "Triangle"
    assert model.vertices == [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.5, 1.0, 0.0]
    assert model.indices == [0, 1, 2]


def test_complex_obj_parsing():
    complex_obj = """
# Complex OBJ with multiple features
o Quad
v -1.0 -1.0 0.0
v 1.0 -1.0 0.0
v 1.0 1.0 0.0
v -1.0 1.0 0.0
vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0
vn 0.0 0.0 1.0
f 1/1/1 2/2/1 3/3/1
f 1/1/1 3/3/1 4/4/1

o Triangle
v 0.0 2.0 0.0
v 1.0 2.0 0.0
v 0.5 3.0 0.0
f 5 6 7
"""
    result = parse_obj_string(complex_obj)
    assert len(result) == 2
    quad = result[0]
    assert quad.name == "Quad"
    assert len(quad.vertices) == 12
    assert quad.indices == [0, 1, 2, 0, 2, 3]
    triangle = result[1]
    assert triangle.name == "Triangle"
    assert triangle.vertices == [0.0, 2.0, 0.0, 1.0, 2.0, 0.0, 0.5, 3.0, 0.0]
    assert triangle.indices == [0, 1, 2]


def test_obj_edge_cases():
    assert parse_obj_string("") == []
    assert parse_obj_string("\n# comment\n\n") == []
    assert parse_obj_string("\no EmptyObject\n# No vertices defined\n") == []

    no_faces = parse_obj_string(
        """
o VerticesOnly
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0
"""
    )
    assert len(no_faces) == 1
    assert no_faces[0].name == "VerticesOnly"
    assert len(no_faces[0].vertices) == 9
    assert no_faces[0].indices == []

    with pytest.raises(Error, match="Failed to parse OBJ data"):
        parse_obj_string(
            """
o TestObject
v 0.0 0.0 0.0
f invalid face
"""
        )

    single = parse_obj_string(
        """
o SingleVertex
v 0.0 0.0 0.0
"""
    )
    assert len(single) == 1
    assert len(single[0].vertices) == 3
    assert single[0].indices == []
    assert parse_obj_string("\no Empty1\no Empty2\no Empty3\n") == []

    large = parse_obj_string(
        """
o LargeNumbers
v 999999.999 -999999.999 0.0
v 0.000001 0.000001 999999.999
f 1 2 1
"""
    )
    vertices = large[0].vertices
    assert vertices[0] > 999999
    assert vertices[1] < -999999
    assert vertices[2] == 0.0
    assert vertices[3] > 0
    assert vertices[4] > 0
    assert vertices[5] > 999999
