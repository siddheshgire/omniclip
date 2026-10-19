// Simple script to generate clean SVG and PNG icon for OmniClip
const fs = require('fs');
const path = require('path');

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#grad)" />
  <!-- Bookmark / Clipper Graphic -->
  <path d="M40 32 C40 28 43 25 47 25 L81 25 C85 25 88 28 88 32 L88 98 L64 82 L40 98 Z" fill="#ffffff" fill-opacity="0.95" />
  <!-- AI Sparkle in center -->
  <path d="M64 42 L66.5 50.5 L75 53 L66.5 55.5 L64 64 L61.5 55.5 L53 53 L61.5 50.5 Z" fill="#8b5cf6" />
</svg>`;

const iconDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

fs.writeFileSync(path.join(iconDir, 'icon.svg'), svgIcon);

// Minimal valid 1-pixel or base PNG generator if canvas is not installed
// Using standard Buffer for a solid 16, 48, 128 icon or simple PNG header
function createColorPng(width, height) {
  // Minimal uncompressed PNG (RGBA)
  const zlib = require('zlib');
  
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = createChunk('IHDR', ihdr);
  
  // IDAT
  // Scanlines with purple/indigo gradient
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData.writeUInt8(0, offset++); // Filter: None
    for (let x = 0; x < width; x++) {
      // Rounded icon gradient with white icon center
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const isInside = dist <= (width / 2) - 1;
      const isCenter = dist <= (width / 4);

      if (!isInside) {
        rawData.writeUInt8(0, offset);     // R
        rawData.writeUInt8(0, offset + 1); // G
        rawData.writeUInt8(0, offset + 2); // B
        rawData.writeUInt8(0, offset + 3); // A (transparent)
      } else if (isCenter) {
        rawData.writeUInt8(255, offset);     // R
        rawData.writeUInt8(255, offset + 1); // G
        rawData.writeUInt8(255, offset + 2); // B
        rawData.writeUInt8(255, offset + 3); // A
      } else {
        rawData.writeUInt8(99, offset);      // R: indigo
        rawData.writeUInt8(102, offset + 1); // G
        rawData.writeUInt8(241, offset + 2); // B
        rawData.writeUInt8(255, offset + 3); // A
      }
      offset += 4;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  // CRC32
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

[16, 48, 128].forEach(size => {
  const png = createColorPng(size, size);
  fs.writeFileSync(path.join(iconDir, `icon${size}.png`), png);
});

console.log('Icons generated successfully.');
