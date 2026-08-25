from dsc.spatial.cross_section import render_cross_section


CUBE_OBJ = """
o Cube
v 0 0 0
v 2 0 0
v 2 0 2
v 0 0 2
v 0 2 0
v 2 2 0
v 2 2 2
v 0 2 2
f 1 2 3
f 1 3 4
f 5 8 7
f 5 7 6
f 1 5 6
f 1 6 2
f 2 6 7
f 2 7 3
f 3 7 8
f 3 8 4
f 4 8 5
f 4 5 1
"""


def test_render_cross_section_png():
    result = render_cross_section(CUBE_OBJ, height=1.0, file_type="png", show_axes=True)
    assert result["yaml"].startswith("free_thresh: 0.196")
    assert result["img"][:8] == b"\x89PNG\r\n\x1a\n"


def test_render_cross_section_bmp():
    result = render_cross_section(CUBE_OBJ, height=1.0, file_type="bmp")
    assert result["img"][:2] == b"BM"
    assert "resolution:" in result["yaml"]
