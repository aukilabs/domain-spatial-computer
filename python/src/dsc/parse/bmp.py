from __future__ import annotations

import struct

from dsc.parse.bitmap import Bitmap


def encode_bmp(image: Bitmap) -> bytes:
    width = image.width
    height = image.height
    raw = image.buffer

    row_size = ((24 * width + 31) // 32) * 4
    padding = row_size - width * 3
    header_size = 54
    pixel_data_size = row_size * height
    file_size = header_size + pixel_data_size

    bmp = bytearray(file_size)
    bmp[0:2] = b"BM"
    struct.pack_into("<I", bmp, 2, file_size)
    struct.pack_into("<I", bmp, 6, 0)
    struct.pack_into("<I", bmp, 10, header_size)
    struct.pack_into("<I", bmp, 14, 40)
    struct.pack_into("<i", bmp, 18, width)
    struct.pack_into("<i", bmp, 22, height)
    struct.pack_into("<H", bmp, 26, 1)
    struct.pack_into("<H", bmp, 28, 24)
    struct.pack_into("<I", bmp, 30, 0)
    struct.pack_into("<I", bmp, 34, pixel_data_size)
    struct.pack_into("<i", bmp, 38, 0)
    struct.pack_into("<i", bmp, 42, 0)
    struct.pack_into("<I", bmp, 46, 0)
    struct.pack_into("<I", bmp, 50, 0)

    offset = header_size
    for y in range(height - 1, -1, -1):
        for x in range(width):
            src = (y * width + x) * 3
            bmp[offset] = raw[src + 2]
            bmp[offset + 1] = raw[src + 1]
            bmp[offset + 2] = raw[src]
            offset += 3
        offset += padding

    return bytes(bmp)
