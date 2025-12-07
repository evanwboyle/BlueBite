const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Utility function to decode base64 and extract PNG data
function extractPNGFromSVG(svgPath) {
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const base64Match = svgContent.match(/href="data:image\/png;base64,([^"]+)"/);

  if (!base64Match) {
    throw new Error(`No PNG data found in ${svgPath}`);
  }

  return Buffer.from(base64Match[1], 'base64');
}

// Simple PNG parsing to get pixel data
function parsePNG(buffer) {
  let offset = 8; // Skip PNG signature
  const width = buffer.readUInt32BE(offset + 8);
  const height = buffer.readUInt32BE(offset + 12);

  let pixelData = [];
  let chunkOffset = 16; // Skip PNG header chunk

  while (chunkOffset < buffer.length - 12) {
    const chunkLength = buffer.readUInt32BE(chunkOffset);
    const chunkType = buffer.toString('ascii', chunkOffset + 4, chunkOffset + 8);

    if (chunkType === 'IDAT') {
      const compressedData = buffer.slice(chunkOffset + 8, chunkOffset + 8 + chunkLength);
      const imageData = zlib.inflateSync(compressedData);

      // Parse scanlines (simple RGBA parsing)
      let pixels = [];
      let idx = 0;
      for (let y = 0; y < height; y++) {
        idx++; // Skip filter byte
        for (let x = 0; x < width; x++) {
          const r = imageData[idx++];
          const g = imageData[idx++];
          const b = imageData[idx++];
          const a = imageData[idx++] || 255;

          // Only include non-transparent pixels
          if (a > 127) {
            pixels.push({ r, g, b, a });
          }
        }
      }

      return pixels;
    }

    chunkOffset += chunkLength + 12;
  }

  return [];
}

// Extract dominant colors from pixel data
function extractColorPalette(pixels, maxColors = 5, minPixels = 100) {
  if (pixels.length === 0) return [];

  // Count color frequencies
  const colorMap = new Map();

  for (const pixel of pixels) {
    // Round colors to nearest 5 to group similar colors
    const key = `${Math.round(pixel.r / 5) * 5},${Math.round(pixel.g / 5) * 5},${Math.round(pixel.b / 5) * 5}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Filter by minimum pixel threshold and sort by frequency
  const palette = Array.from(colorMap.entries())
    .filter(([_, count]) => count >= minPixels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([color, count]) => {
      const [r, g, b] = color.split(',').map(Number);
      return {
        color: `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`,
        pixelCount: count,
        percentage: ((count / pixels.length) * 100).toFixed(2)
      };
    });

  return palette;
}

// Main script
const iconsDir = path.join(__dirname, 'public/assets/resco-icons');
const output = {};

const files = fs.readdirSync(iconsDir)
  .filter(f => f.endsWith('.svg'))
  .sort();

console.log(`Found ${files.length} SVG files. Processing...\n`);

for (const file of files) {
  const filePath = path.join(iconsDir, file);
  const rescoName = path.basename(file, '.svg');

  try {
    console.log(`Processing: ${rescoName}`);
    const pngBuffer = extractPNGFromSVG(filePath);
    const pixels = parsePNG(pngBuffer);
    const palette = extractColorPalette(pixels, 5, 100);

    output[rescoName] = {
      colors: palette,
      totalPixels: pixels.length
    };

    console.log(`  ✓ Found ${palette.length} colors\n`);
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}\n`);
  }
}

// Write output to JSON file
const outputPath = path.join(iconsDir, 'color-palettes.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`\n✓ Color palettes saved to: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`- Total rescos processed: ${Object.keys(output).length}`);
console.log(`- Output file: color-palettes.json`);
