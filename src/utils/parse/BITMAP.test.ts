import { assertEquals } from "jsr:@std/assert";
import { BITMAP } from "./BITMAP.ts";

Deno.test("BITMAP constructor - basic initialization", () => {
  const bitmap = new BITMAP(10, 5);

  // Test dimensions
  assertEquals(bitmap.width, 10);
  assertEquals(bitmap.height, 5);

  // Test buffer size (width * height * 3 bytes per pixel)
  assertEquals(bitmap.buffer.length, 150);

  // Test buffer initialization (should be filled with 0xff - white)
  for (let i = 0; i < bitmap.buffer.length; i++) {
    assertEquals(bitmap.buffer[i], 0xff);
  }
});

Deno.test("BITMAP constructor - fractional dimensions", () => {
  const bitmap = new BITMAP(10.7, 5.3);

  // Dimensions should be floored
  assertEquals(bitmap.width, 10);
  assertEquals(bitmap.height, 5);
  assertEquals(bitmap.buffer.length, 150);
});

Deno.test("BITMAP constructor - edge case dimensions", () => {
  // Test 1x1 bitmap
  const small = new BITMAP(1, 1);
  assertEquals(small.width, 1);
  assertEquals(small.height, 1);
  assertEquals(small.buffer.length, 3);

  // Test 0x0 bitmap
  const empty = new BITMAP(0, 0);
  assertEquals(empty.width, 0);
  assertEquals(empty.height, 0);
  assertEquals(empty.buffer.length, 0);
});

Deno.test("BITMAP setPixel - basic functionality", () => {
  const bitmap = new BITMAP(3, 3);

  // Set a red pixel at (1, 1)
  bitmap.setPixel(1, 1, 0xff0000);

  // Calculate expected index: x * 3 + width * 3 * y = 1 * 3 + 3 * 3 * 1 = 12
  const index = 12;
  assertEquals(bitmap.buffer[index], 0xff); // Red component
  assertEquals(bitmap.buffer[index + 1], 0x00); // Green component
  assertEquals(bitmap.buffer[index + 2], 0x00); // Blue component

  // Set a green pixel at (0, 0)
  bitmap.setPixel(0, 0, 0x00ff00);
  assertEquals(bitmap.buffer[0], 0x00); // Red
  assertEquals(bitmap.buffer[1], 0xff); // Green
  assertEquals(bitmap.buffer[2], 0x00); // Blue

  // Set a blue pixel at (2, 2)
  bitmap.setPixel(2, 2, 0x0000ff);
  const blueIndex = 2 * 3 + 3 * 3 * 2; // = 24
  assertEquals(bitmap.buffer[blueIndex], 0x00); // Red
  assertEquals(bitmap.buffer[blueIndex + 1], 0x00); // Green
  assertEquals(bitmap.buffer[blueIndex + 2], 0xff); // Blue
});

Deno.test("BITMAP setPixel - color component extraction", () => {
  const bitmap = new BITMAP(2, 2);

  // Test various color values
  bitmap.setPixel(0, 0, 0x123456);
  assertEquals(bitmap.buffer[0], 0x12); // Red component
  assertEquals(bitmap.buffer[1], 0x34); // Green component
  assertEquals(bitmap.buffer[2], 0x56); // Blue component

  bitmap.setPixel(1, 0, 0xabcdef);
  assertEquals(bitmap.buffer[3], 0xab); // Red
  assertEquals(bitmap.buffer[4], 0xcd); // Green
  assertEquals(bitmap.buffer[5], 0xef); // Blue

  // Test maximum values
  bitmap.setPixel(0, 1, 0xffffff);
  const index = 0 * 3 + 2 * 3 * 1; // = 6
  assertEquals(bitmap.buffer[index], 0xff);
  assertEquals(bitmap.buffer[index + 1], 0xff);
  assertEquals(bitmap.buffer[index + 2], 0xff);
});

Deno.test("BITMAP setPixel - fractional coordinates", () => {
  const bitmap = new BITMAP(3, 3);

  // Fractional coordinates should be floored
  bitmap.setPixel(1.7, 1.9, 0xff0000);

  // Should be treated as (1, 1)
  const index = 1 * 3 + 3 * 3 * 1; // = 12
  assertEquals(bitmap.buffer[index], 0xff);
  assertEquals(bitmap.buffer[index + 1], 0x00);
  assertEquals(bitmap.buffer[index + 2], 0x00);
});

Deno.test("BITMAP setPixel - bounds checking", () => {
  const bitmap = new BITMAP(3, 3);
  const originalBuffer = new Uint8Array(bitmap.buffer);

  // Test out of bounds coordinates (should be ignored)
  bitmap.setPixel(-1, 1, 0xff0000); // Negative x
  bitmap.setPixel(1, -1, 0xff0000); // Negative y
  bitmap.setPixel(3, 1, 0xff0000); // x >= width
  bitmap.setPixel(1, 3, 0xff0000); // y >= height
  bitmap.setPixel(10, 10, 0xff0000); // Way out of bounds

  // Buffer should remain unchanged (all 0xff from initialization)
  for (let i = 0; i < bitmap.buffer.length; i++) {
    assertEquals(bitmap.buffer[i], originalBuffer[i]);
  }
});

Deno.test("BITMAP drawLine - basic functionality", () => {
  const bitmap = new BITMAP(5, 5);

  // Draw a 3x2 red rectangle starting at (1, 1)
  bitmap.drawLine(1, 1, 3, 2, 0xff0000);

  // Check that the correct pixels are set
  for (let y = 1; y < 3; y++) {
    for (let x = 1; x < 4; x++) {
      const index = x * 3 + 5 * 3 * y;
      assertEquals(bitmap.buffer[index], 0xff, `Red component at (${x}, ${y})`);
      assertEquals(
        bitmap.buffer[index + 1],
        0x00,
        `Green component at (${x}, ${y})`
      );
      assertEquals(
        bitmap.buffer[index + 2],
        0x00,
        `Blue component at (${x}, ${y})`
      );
    }
  }

  // Check that pixels outside the rectangle are still white (0xff)
  assertEquals(bitmap.buffer[0], 0xff); // (0, 0) should be white
  assertEquals(bitmap.buffer[1], 0xff);
  assertEquals(bitmap.buffer[2], 0xff);
});

Deno.test("BITMAP drawLine - edge cases", () => {
  const bitmap = new BITMAP(3, 3);

  // Draw 1x1 "line" (single pixel)
  bitmap.drawLine(1, 1, 1, 1, 0x00ff00);
  const index = 1 * 3 + 3 * 3 * 1; // = 12
  assertEquals(bitmap.buffer[index], 0x00);
  assertEquals(bitmap.buffer[index + 1], 0xff);
  assertEquals(bitmap.buffer[index + 2], 0x00);

  // Draw 0x0 "line" (should do nothing)
  const originalBuffer = new Uint8Array(bitmap.buffer);
  bitmap.drawLine(0, 0, 0, 0, 0xff0000);
  for (let i = 0; i < bitmap.buffer.length; i++) {
    assertEquals(bitmap.buffer[i], originalBuffer[i]);
  }
});

Deno.test("BITMAP drawRect - basic functionality", () => {
  const bitmap = new BITMAP(5, 5);

  // Draw a rectangle from (1, 1) to (4, 3) - should be 3x2 pixels
  bitmap.drawRect(1, 1, 4, 3, 0x0000ff);

  // Verify the rectangle pixels
  for (let y = 1; y < 3; y++) {
    for (let x = 1; x < 4; x++) {
      const index = x * 3 + 5 * 3 * y;
      assertEquals(bitmap.buffer[index], 0x00, `Red at (${x}, ${y})`);
      assertEquals(bitmap.buffer[index + 1], 0x00, `Green at (${x}, ${y})`);
      assertEquals(bitmap.buffer[index + 2], 0xff, `Blue at (${x}, ${y})`);
    }
  }
});

Deno.test("BITMAP drawRect - edge cases", () => {
  const bitmap = new BITMAP(4, 4);

  // Draw rectangle with same start and end points (should draw nothing)
  const originalBuffer = new Uint8Array(bitmap.buffer);
  bitmap.drawRect(2, 2, 2, 2, 0xff0000);
  for (let i = 0; i < bitmap.buffer.length; i++) {
    assertEquals(bitmap.buffer[i], originalBuffer[i]);
  }

  // Draw 1-pixel wide rectangle
  bitmap.drawRect(1, 1, 2, 3, 0x00ff00);
  // Should draw from (1,1) with width=1, height=2
  for (let y = 1; y < 3; y++) {
    const index = 1 * 3 + 4 * 3 * y;
    assertEquals(bitmap.buffer[index], 0x00); // Red
    assertEquals(bitmap.buffer[index + 1], 0xff); // Green
    assertEquals(bitmap.buffer[index + 2], 0x00); // Blue
  }
});

Deno.test("BITMAP integration - complex drawing", () => {
  const bitmap = new BITMAP(10, 10);

  // Draw a pattern: red background, green border, blue center dot
  bitmap.drawLine(0, 0, 10, 10, 0xff0000); // Fill with red
  bitmap.drawRect(0, 0, 10, 1, 0x00ff00); // Top border
  bitmap.drawRect(0, 9, 10, 1, 0x00ff00); // Bottom border
  bitmap.drawRect(0, 0, 1, 10, 0x00ff00); // Left border
  bitmap.drawRect(9, 0, 1, 10, 0x00ff00); // Right border
  bitmap.setPixel(5, 5, 0x0000ff); // Center blue dot

  // Verify corners are green (border)
  assertEquals(bitmap.buffer[0], 0x00); // (0,0) red
  assertEquals(bitmap.buffer[1], 0xff); // (0,0) green
  assertEquals(bitmap.buffer[2], 0x00); // (0,0) blue

  // Verify center is blue
  const centerIndex = 5 * 3 + 10 * 3 * 5; // = 165
  assertEquals(bitmap.buffer[centerIndex], 0x00); // Red
  assertEquals(bitmap.buffer[centerIndex + 1], 0x00); // Green
  assertEquals(bitmap.buffer[centerIndex + 2], 0xff); // Blue

  // Verify interior is red (not border, not center)
  const interiorIndex = 3 * 3 + 10 * 3 * 3; // (3,3) = 99
  assertEquals(bitmap.buffer[interiorIndex], 0xff); // Red
  assertEquals(bitmap.buffer[interiorIndex + 1], 0x00); // Green
  assertEquals(bitmap.buffer[interiorIndex + 2], 0x00); // Blue
});
