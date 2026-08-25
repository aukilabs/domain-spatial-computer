import struct

from dsc.parse.bitmap import Bitmap
from dsc.parse.bmp import encode_bmp


def _u32(buf: bytes, offset: int) -> int:
    return struct.unpack_from("<I", buf, offset)[0]


def _i32(buf: bytes, offset: int) -> int:
    return struct.unpack_from("<i", buf, offset)[0]


def _u16(buf: bytes, offset: int) -> int:
    return struct.unpack_from("<H", buf, offset)[0]


def test_encode_bmp_basic():
    bitmap = Bitmap(2, 2)
    bitmap.set_pixel(0, 0, 0xFF0000)
    bitmap.set_pixel(1, 0, 0x00FF00)
    bitmap.set_pixel(0, 1, 0x0000FF)
    bitmap.set_pixel(1, 1, 0xFFFFFF)
    result = encode_bmp(bitmap)
    assert isinstance(result, bytes)
    assert len(result) > 54
    assert result[0:2] == b"BM"
    assert _u32(result, 2) == len(result)
    assert _u32(result, 10) == 54
    assert _u32(result, 14) == 40
    assert _i32(result, 18) == 2
    assert _i32(result, 22) == 2
    assert _u16(result, 28) == 24
    assert _u32(result, 30) == 0
    start = 54
    assert result[start] == 0xFF
    assert result[start + 1] == 0x00
    assert result[start + 2] == 0x00
    assert result[start + 3] == 0xFF
    assert result[start + 4] == 0xFF
    assert result[start + 5] == 0xFF
    assert result[start + 8] == 0x00
    assert result[start + 9] == 0x00
    assert result[start + 10] == 0xFF
    assert result[start + 11] == 0x00
    assert result[start + 12] == 0xFF
    assert result[start + 13] == 0x00


def test_encode_bmp_padding():
    bitmap = Bitmap(3, 3)
    for y in range(3):
        for x in range(3):
            color = 0xFF0000 if (x + y) % 2 == 0 else 0x0000FF
            bitmap.set_pixel(x, y, color)
    result = encode_bmp(bitmap)
    assert _i32(result, 18) == 3
    assert _i32(result, 22) == 3
    expected_row = ((24 * 3 + 31) // 32) * 4
    assert expected_row == 12
    assert _u32(result, 34) == expected_row * 3
    start = 54
    assert result[start] == 0x00
    assert result[start + 2] == 0xFF
    assert result[start + 3] == 0xFF
    row1 = start + 12
    assert result[row1] == 0xFF
    assert result[row1 + 3] == 0x00
    assert result[row1 + 5] == 0xFF


def test_encode_bmp_edge_cases():
    single = Bitmap(1, 1)
    single.set_pixel(0, 0, 0x123456)
    result = encode_bmp(single)
    assert result[0:2] == b"BM"
    assert _i32(result, 18) == 1
    assert _i32(result, 22) == 1
    assert result[54] == 0x56
    assert result[55] == 0x34
    assert result[56] == 0x12

    empty = encode_bmp(Bitmap(0, 0))
    assert empty[0:2] == b"BM"
    assert _i32(empty, 18) == 0
    assert _i32(empty, 22) == 0
    assert _u32(empty, 34) == 0
    assert len(empty) == 54

    wide = Bitmap(100, 1)
    for x in range(100):
        wide.set_pixel(x, 0, 0xFF0000 if x % 2 == 0 else 0x0000FF)
    wide_result = encode_bmp(wide)
    assert _i32(wide_result, 18) == 100
    assert _u32(wide_result, 34) == 300

    tall = Bitmap(1, 100)
    for y in range(100):
        tall.set_pixel(0, y, 0xFF0000)
    assert _u32(encode_bmp(tall), 34) == 400
