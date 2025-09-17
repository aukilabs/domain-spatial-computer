import { assertEquals } from "jsr:@std/assert";
import { encodeBmp } from "./bmpEncoder.ts";
import { BITMAP } from "./BITMAP.ts";
import { Buffer } from "node:buffer";

Deno.test("encodeBmp - basic BMP encoding", () => {
  // Create a simple 2x2 image with known colors
  const bitmap = new BITMAP(2, 2);

  // Set pixels to known colors
  bitmap.setPixel(0, 0, 0xff0000); // Red
  bitmap.setPixel(1, 0, 0x00ff00); // Green
  bitmap.setPixel(0, 1, 0x0000ff); // Blue
  bitmap.setPixel(1, 1, 0xffffff); // White

  const result = encodeBmp(bitmap);

  // Test basic structure
  assertEquals(result instanceof Buffer, true);
  assertEquals(result.length > 54, true); // Should be larger than header size

  // Test BMP signature
  assertEquals(result.toString("ascii", 0, 2), "BM");

  // Test file size field (should match actual buffer length)
  const fileSizeFromHeader = result.readUInt32LE(2);
  assertEquals(fileSizeFromHeader, result.length);

  // Test pixel data offset (should be 54 for standard BMP)
  const pixelDataOffset = result.readUInt32LE(10);
  assertEquals(pixelDataOffset, 54);

  // Test DIB header size
  const dibHeaderSize = result.readUInt32LE(14);
  assertEquals(dibHeaderSize, 40);

  // Test image dimensions
  const width = result.readInt32LE(18);
  const height = result.readInt32LE(22);
  assertEquals(width, 2);
  assertEquals(height, 2);

  // Test color depth (should be 24-bit)
  const bitsPerPixel = result.readUInt16LE(28);
  assertEquals(bitsPerPixel, 24);

  // Test compression (should be 0 for no compression)
  const compression = result.readUInt32LE(30);
  assertEquals(compression, 0);

  // Test pixel data format (BGR, bottom-to-top)
  // For a 2x2 image, row size = (24 * 2 + 31) / 32 * 4 = 8 bytes per row
  const pixelDataStart = 54;

  // Bottom row first (y=1): Blue(0,1), White(1,1)
  assertEquals(result[pixelDataStart], 0xff); // Blue pixel B component
  assertEquals(result[pixelDataStart + 1], 0x00); // Blue pixel G component
  assertEquals(result[pixelDataStart + 2], 0x00); // Blue pixel R component
  assertEquals(result[pixelDataStart + 3], 0xff); // White pixel B component
  assertEquals(result[pixelDataStart + 4], 0xff); // White pixel G component
  assertEquals(result[pixelDataStart + 5], 0xff); // White pixel R component

  // Top row second (y=0): Red(0,0), Green(1,0)
  assertEquals(result[pixelDataStart + 8], 0x00); // Red pixel B component
  assertEquals(result[pixelDataStart + 9], 0x00); // Red pixel G component
  assertEquals(result[pixelDataStart + 10], 0xff); // Red pixel R component
  assertEquals(result[pixelDataStart + 11], 0x00); // Green pixel B component
  assertEquals(result[pixelDataStart + 12], 0xff); // Green pixel G component
  assertEquals(result[pixelDataStart + 13], 0x00); // Green pixel R component
});

Deno.test("encodeBmp - complex BMP encoding", () => {
  // Test with 3x3 image (width not divisible by 4, requires padding)
  const bitmap = new BITMAP(3, 3);

  // Fill with a pattern to test row padding
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const color = (x + y) % 2 === 0 ? 0xff0000 : 0x0000ff; // Red/Blue checkerboard
      bitmap.setPixel(x, y, color);
    }
  }

  const result = encodeBmp(bitmap);

  // Test dimensions
  const width = result.readInt32LE(18);
  const height = result.readInt32LE(22);
  assertEquals(width, 3);
  assertEquals(height, 3);

  // Test row size calculation: (24 * 3 + 31) / 32 * 4 = 12 bytes per row
  const expectedRowSize = Math.floor((24 * 3 + 31) / 32) * 4;
  assertEquals(expectedRowSize, 12); // 9 pixel bytes + 3 padding bytes

  const expectedPixelDataSize = expectedRowSize * 3;
  const pixelDataSize = result.readUInt32LE(34);
  assertEquals(pixelDataSize, expectedPixelDataSize);

  // Test bottom-to-top pixel order and padding
  const pixelDataStart = 54;

  // Bottom row (y=2): Red, Blue, Red + 3 bytes padding
  assertEquals(result[pixelDataStart], 0x00); // Red B
  assertEquals(result[pixelDataStart + 1], 0x00); // Red G
  assertEquals(result[pixelDataStart + 2], 0xff); // Red R
  assertEquals(result[pixelDataStart + 3], 0xff); // Blue B
  assertEquals(result[pixelDataStart + 4], 0x00); // Blue G
  assertEquals(result[pixelDataStart + 5], 0x00); // Blue R
  assertEquals(result[pixelDataStart + 6], 0x00); // Red B
  assertEquals(result[pixelDataStart + 7], 0x00); // Red G
  assertEquals(result[pixelDataStart + 8], 0xff); // Red R
  // Bytes 9, 10, 11 are padding (can be anything)

  // Middle row (y=1): Blue, Red, Blue + 3 bytes padding
  const row1Start = pixelDataStart + 12;
  assertEquals(result[row1Start], 0xff); // Blue B
  assertEquals(result[row1Start + 1], 0x00); // Blue G
  assertEquals(result[row1Start + 2], 0x00); // Blue R
  assertEquals(result[row1Start + 3], 0x00); // Red B
  assertEquals(result[row1Start + 4], 0x00); // Red G
  assertEquals(result[row1Start + 5], 0xff); // Red R
  assertEquals(result[row1Start + 6], 0xff); // Blue B
  assertEquals(result[row1Start + 7], 0x00); // Blue G
  assertEquals(result[row1Start + 8], 0x00); // Blue R

  // Top row (y=0): Red, Blue, Red + 3 bytes padding
  const row0Start = pixelDataStart + 24;
  assertEquals(result[row0Start], 0x00); // Red B
  assertEquals(result[row0Start + 1], 0x00); // Red G
  assertEquals(result[row0Start + 2], 0xff); // Red R
  assertEquals(result[row0Start + 3], 0xff); // Blue B
  assertEquals(result[row0Start + 4], 0x00); // Blue G
  assertEquals(result[row0Start + 5], 0x00); // Blue R

  // Test with 1x4 image (tall and narrow)
  const tallBitmap = new BITMAP(1, 4);
  tallBitmap.setPixel(0, 0, 0xff0000); // Red
  tallBitmap.setPixel(0, 1, 0x00ff00); // Green
  tallBitmap.setPixel(0, 2, 0x0000ff); // Blue
  tallBitmap.setPixel(0, 3, 0xffffff); // White

  const tallResult = encodeBmp(tallBitmap);

  // Test dimensions
  assertEquals(tallResult.readInt32LE(18), 1); // width
  assertEquals(tallResult.readInt32LE(22), 4); // height

  // Row size for 1 pixel: (24 * 1 + 31) / 32 * 4 = 4 bytes (3 pixel + 1 padding)
  const tallRowSize = Math.floor((24 * 1 + 31) / 32) * 4;
  assertEquals(tallRowSize, 4);

  const tallPixelDataSize = tallResult.readUInt32LE(34);
  assertEquals(tallPixelDataSize, 16); // 4 rows * 4 bytes per row
});

Deno.test("encodeBmp - edge cases", () => {
  // Test 1x1 image (smallest possible valid image)
  const singlePixel = new BITMAP(1, 1);
  singlePixel.setPixel(0, 0, 0x123456);

  const singleResult = encodeBmp(singlePixel);

  // Test basic structure
  assertEquals(singleResult.toString("ascii", 0, 2), "BM");
  assertEquals(singleResult.readInt32LE(18), 1); // width
  assertEquals(singleResult.readInt32LE(22), 1); // height

  // Row size for 1 pixel: (24 * 1 + 31) / 32 * 4 = 4 bytes
  const singleRowSize = Math.floor((24 * 1 + 31) / 32) * 4;
  assertEquals(singleRowSize, 4);

  // Check pixel data (BGR format)
  const pixelStart = 54;
  assertEquals(singleResult[pixelStart], 0x56); // B component
  assertEquals(singleResult[pixelStart + 1], 0x34); // G component
  assertEquals(singleResult[pixelStart + 2], 0x12); // R component
  // Byte 3 is padding

  // Test 0x0 image (edge case - should still work)
  const emptyBitmap = new BITMAP(0, 0);
  const emptyResult = encodeBmp(emptyBitmap);

  assertEquals(emptyResult.toString("ascii", 0, 2), "BM");
  assertEquals(emptyResult.readInt32LE(18), 0); // width
  assertEquals(emptyResult.readInt32LE(22), 0); // height
  assertEquals(emptyResult.readUInt32LE(34), 0); // pixel data size should be 0
  assertEquals(emptyResult.length, 54); // Should only contain headers

  // Test very wide image (tests row size calculation limits)
  const wideBitmap = new BITMAP(100, 1);
  for (let x = 0; x < 100; x++) {
    wideBitmap.setPixel(x, 0, x % 2 === 0 ? 0xff0000 : 0x0000ff);
  }

  const wideResult = encodeBmp(wideBitmap);
  assertEquals(wideResult.readInt32LE(18), 100); // width
  assertEquals(wideResult.readInt32LE(22), 1); // height

  // Row size for 100 pixels: (24 * 100 + 31) / 32 * 4 = 300 bytes (no padding needed)
  const expectedWideRowSize = Math.floor((24 * 100 + 31) / 32) * 4;
  assertEquals(expectedWideRowSize, 300);

  const widePixelDataSize = wideResult.readUInt32LE(34);
  assertEquals(widePixelDataSize, 300);

  // Test very tall image
  const tallBitmap = new BITMAP(1, 100);
  for (let y = 0; y < 100; y++) {
    tallBitmap.setPixel(
      0,
      y,
      y % 3 === 0 ? 0xff0000 : y % 3 === 1 ? 0x00ff00 : 0x0000ff
    );
  }

  const tallResult = encodeBmp(tallBitmap);
  assertEquals(tallResult.readInt32LE(18), 1); // width
  assertEquals(tallResult.readInt32LE(22), 100); // height

  // Row size for 1 pixel: 4 bytes, 100 rows = 400 bytes total
  const tallPixelDataSize = tallResult.readUInt32LE(34);
  assertEquals(tallPixelDataSize, 400);

  // Test image with maximum color values
  const maxColorBitmap = new BITMAP(2, 2);
  maxColorBitmap.setPixel(0, 0, 0x000000); // Black
  maxColorBitmap.setPixel(1, 0, 0xffffff); // White
  maxColorBitmap.setPixel(0, 1, 0xff0000); // Pure red
  maxColorBitmap.setPixel(1, 1, 0x00ff00); // Pure green

  const maxColorResult = encodeBmp(maxColorBitmap);
  const maxColorPixelStart = 54;

  // Bottom row (y=1): Red, Green
  assertEquals(maxColorResult[maxColorPixelStart], 0x00); // Red B
  assertEquals(maxColorResult[maxColorPixelStart + 1], 0x00); // Red G
  assertEquals(maxColorResult[maxColorPixelStart + 2], 0xff); // Red R
  assertEquals(maxColorResult[maxColorPixelStart + 3], 0x00); // Green B
  assertEquals(maxColorResult[maxColorPixelStart + 4], 0xff); // Green G
  assertEquals(maxColorResult[maxColorPixelStart + 5], 0x00); // Green R

  // Top row (y=0): Black, White
  assertEquals(maxColorResult[maxColorPixelStart + 8], 0x00); // Black B
  assertEquals(maxColorResult[maxColorPixelStart + 9], 0x00); // Black G
  assertEquals(maxColorResult[maxColorPixelStart + 10], 0x00); // Black R
  assertEquals(maxColorResult[maxColorPixelStart + 11], 0xff); // White B
  assertEquals(maxColorResult[maxColorPixelStart + 12], 0xff); // White G
  assertEquals(maxColorResult[maxColorPixelStart + 13], 0xff); // White R

  // Test fractional dimensions (should be floored by BITMAP constructor)
  const fractionalBitmap = new BITMAP(2.7, 1.9);
  assertEquals(fractionalBitmap.width, 2); // Should be floored
  assertEquals(fractionalBitmap.height, 1); // Should be floored

  const fractionalResult = encodeBmp(fractionalBitmap);
  assertEquals(fractionalResult.readInt32LE(18), 2); // width
  assertEquals(fractionalResult.readInt32LE(22), 1); // height
});
