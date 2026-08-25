from dsc.parse.bitmap import Bitmap


def test_constructor_basic():
    bitmap = Bitmap(10, 5)
    assert bitmap.width == 10
    assert bitmap.height == 5
    assert len(bitmap.buffer) == 150
    assert all(value == 0xFF for value in bitmap.buffer)


def test_constructor_fractional():
    bitmap = Bitmap(10.7, 5.3)
    assert bitmap.width == 10
    assert bitmap.height == 5
    assert len(bitmap.buffer) == 150


def test_constructor_edge_dimensions():
    small = Bitmap(1, 1)
    assert small.width == 1
    assert small.height == 1
    assert len(small.buffer) == 3
    empty = Bitmap(0, 0)
    assert empty.width == 0
    assert empty.height == 0
    assert len(empty.buffer) == 0


def test_set_pixel_basic():
    bitmap = Bitmap(3, 3)
    bitmap.set_pixel(1, 1, 0xFF0000)
    index = 12
    assert bitmap.buffer[index] == 0xFF
    assert bitmap.buffer[index + 1] == 0x00
    assert bitmap.buffer[index + 2] == 0x00
    bitmap.set_pixel(0, 0, 0x00FF00)
    assert bitmap.buffer[0] == 0x00
    assert bitmap.buffer[1] == 0xFF
    assert bitmap.buffer[2] == 0x00
    bitmap.set_pixel(2, 2, 0x0000FF)
    blue_index = 24
    assert bitmap.buffer[blue_index] == 0x00
    assert bitmap.buffer[blue_index + 1] == 0x00
    assert bitmap.buffer[blue_index + 2] == 0xFF


def test_set_pixel_color_components():
    bitmap = Bitmap(2, 2)
    bitmap.set_pixel(0, 0, 0x123456)
    assert bitmap.buffer[0] == 0x12
    assert bitmap.buffer[1] == 0x34
    assert bitmap.buffer[2] == 0x56
    bitmap.set_pixel(1, 0, 0xABCDEF)
    assert bitmap.buffer[3] == 0xAB
    assert bitmap.buffer[4] == 0xCD
    assert bitmap.buffer[5] == 0xEF
    bitmap.set_pixel(0, 1, 0xFFFFFF)
    index = 6
    assert bitmap.buffer[index] == 0xFF
    assert bitmap.buffer[index + 1] == 0xFF
    assert bitmap.buffer[index + 2] == 0xFF


def test_set_pixel_fractional_and_bounds():
    bitmap = Bitmap(3, 3)
    bitmap.set_pixel(1.7, 1.9, 0xFF0000)
    index = 12
    assert bitmap.buffer[index] == 0xFF
    original = bitmap.buffer[:]
    bitmap.set_pixel(-1, 1, 0xFF0000)
    bitmap.set_pixel(1, -1, 0xFF0000)
    bitmap.set_pixel(3, 1, 0xFF0000)
    bitmap.set_pixel(1, 3, 0xFF0000)
    bitmap.set_pixel(10, 10, 0xFF0000)
    assert list(bitmap.buffer) == list(original)


def test_draw_line_and_rect():
    bitmap = Bitmap(5, 5)
    bitmap.draw_line(1, 1, 3, 2, 0xFF0000)
    for y in range(1, 3):
        for x in range(1, 4):
            index = x * 3 + 5 * 3 * y
            assert bitmap.buffer[index] == 0xFF
            assert bitmap.buffer[index + 1] == 0x00
            assert bitmap.buffer[index + 2] == 0x00
    assert bitmap.buffer[0] == 0xFF

    tiny = Bitmap(3, 3)
    tiny.draw_line(1, 1, 1, 1, 0x00FF00)
    index = 12
    assert tiny.buffer[index] == 0x00
    assert tiny.buffer[index + 1] == 0xFF
    original = tiny.buffer[:]
    tiny.draw_line(0, 0, 0, 0, 0xFF0000)
    assert list(tiny.buffer) == list(original)

    rect = Bitmap(5, 5)
    rect.draw_rect(1, 1, 4, 3, 0x0000FF)
    for y in range(1, 3):
        for x in range(1, 4):
            index = x * 3 + 5 * 3 * y
            assert rect.buffer[index + 2] == 0xFF
