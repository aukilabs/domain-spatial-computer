export class BITMAP {
  buffer: Uint8Array;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
    this.buffer = new Uint8Array(this.width * this.height * 3);
    this.buffer.fill(0xff);
  }

  setPixel(x: number, y: number, color: number) {
    x = Math.floor(x);
    y = Math.floor(y);

    if (x >= this.width || y >= this.height || x < 0 || y < 0) return;

    const red = (color >> 16) & 0xff;
    const green = (color >> 8) & 0xff;
    const blue = color & 0xff;
    const index = x * 3 + this.width * 3 * y;

    this.buffer[index] = red;
    this.buffer[index + 1] = green;
    this.buffer[index + 2] = blue;
  }

  drawRect(x1: number, y1: number, x2: number, y2: number, color: number) {
    this.drawLine(x1, y1, x2 - x1, y2 - y1, color);
  }

  drawLine(x: number, y: number, width: number, height: number, color: number) {
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        this.setPixel(x + i, y + j, color);
      }
    }
  }
}
