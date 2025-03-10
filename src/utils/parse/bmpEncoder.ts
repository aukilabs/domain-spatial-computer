import { BITMAP } from "./BITMAP.ts";
import { Buffer } from "node:buffer";

export function encodeBmp(image: BITMAP) {
  try {
    const width = image.width;
    const height = image.height;
    const rawData = image.buffer;

    // Calculate BMP file structure sizes
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const padding = rowSize - width * 3;
    const headerSize = 54; // 14 (file header) + 40 (DIB header)
    const pixelDataSize = rowSize * height;
    const fileSize = headerSize + pixelDataSize;

    // Create and populate BMP buffer
    const bmp = Buffer.alloc(fileSize);

    // File header (14 bytes)
    bmp.write("BM", 0); // Signature
    bmp.writeUInt32LE(fileSize, 2); // File size
    bmp.writeUInt32LE(0, 6); // Reserved
    bmp.writeUInt32LE(headerSize, 10); // Pixel data offset

    // DIB header (40 bytes)
    bmp.writeUInt32LE(40, 14); // DIB header size
    bmp.writeInt32LE(width, 18); // Width
    bmp.writeInt32LE(height, 22); // Height (positive for bottom-up)
    bmp.writeUInt16LE(1, 26); // Color planes
    bmp.writeUInt16LE(24, 28); // Bits per pixel (24 for RGB)
    bmp.writeUInt32LE(0, 30); // No compression
    bmp.writeUInt32LE(pixelDataSize, 34); // Image size
    bmp.writeInt32LE(0, 38); // X pixels per meter
    bmp.writeInt32LE(0, 42); // Y pixels per meter
    bmp.writeUInt32LE(0, 46); // Colors in color table
    bmp.writeUInt32LE(0, 50); // Important colors

    // Write pixel data (BGR format, bottom-to-top)
    let offset = headerSize;

    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const srcPos = (y * width + x) * 3;
        bmp[offset++] = rawData[srcPos + 2]; // B
        bmp[offset++] = rawData[srcPos + 1]; // G
        bmp[offset++] = rawData[srcPos]; // R
      }

      // Add row padding
      offset += padding;
    }

    return bmp;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
