from __future__ import annotations

import array


class Bitmap:
    def __init__(self, width: float, height: float) -> None:
        self.width = int(width)
        self.height = int(height)
        self.buffer = array.array("B", [0xFF] * (self.width * self.height * 3))

    def set_pixel(self, x: float, y: float, color: int) -> None:
        x = int(x)
        y = int(y)
        if x >= self.width or y >= self.height or x < 0 or y < 0:
            return

        red = (color >> 16) & 0xFF
        green = (color >> 8) & 0xFF
        blue = color & 0xFF
        index = x * 3 + self.width * 3 * y
        self.buffer[index] = red
        self.buffer[index + 1] = green
        self.buffer[index + 2] = blue

    def draw_rect(
        self, x1: float, y1: float, x2: float, y2: float, color: int
    ) -> None:
        self.draw_line(x1, y1, x2 - x1, y2 - y1, color)

    def draw_line(
        self, x: float, y: float, width: float, height: float, color: int
    ) -> None:
        for i in range(int(width)):
            for j in range(int(height)):
                self.set_pixel(x + i, y + j, color)
