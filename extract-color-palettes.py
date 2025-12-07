#!/usr/bin/env python3
import json
import os
import re
import base64
from pathlib import Path
from PIL import Image
from io import BytesIO
from collections import Counter

def extract_png_from_svg(svg_path):
    """Extract base64 PNG data from SVG file."""
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # Find base64 PNG data in href attribute
    match = re.search(r'href="data:image/png;base64,([^"]+)"', svg_content)
    if not match:
        raise ValueError(f"No PNG data found in {svg_path}")

    png_base64 = match.group(1)
    png_bytes = base64.b64decode(png_base64)
    return png_bytes

def extract_color_palette(image, max_colors=5, min_pixels=100):
    """Extract dominant colors from image."""
    # Convert to RGBA if needed
    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    # Get pixel data
    pixels = list(image.getdata())

    # Filter out transparent pixels
    opaque_pixels = [
        (r, g, b, a) for r, g, b, a in pixels
        if a > 127  # Only count pixels with >50% opacity
    ]

    if not opaque_pixels:
        return []

    # Quantize colors to reduce noise (group similar colors)
    quantized = []
    for r, g, b, a in opaque_pixels:
        # Round to nearest 15 to group similar colors (wider range)
        qr = round(r / 15) * 15
        qg = round(g / 15) * 15
        qb = round(b / 15) * 15
        quantized.append((qr, qg, qb))

    # Count color frequencies
    color_counts = Counter(quantized)

    # Filter by minimum pixel threshold and get top colors
    filtered = [
        (color, count) for color, count in color_counts.items()
        if count >= min_pixels
    ]
    filtered.sort(key=lambda x: x[1], reverse=True)

    # Format as hex colors with metadata
    palette = []
    for (r, g, b), count in filtered[:max_colors]:
        hex_color = f'#{r:02X}{g:02X}{b:02X}'
        percentage = (count / len(opaque_pixels)) * 100
        palette.append({
            'color': hex_color,
            'pixelCount': count,
            'percentage': round(percentage, 2)
        })

    return palette

def main():
    icons_dir = Path(__file__).parent / 'public' / 'assets' / 'resco-icons'

    # Find all SVG files
    svg_files = sorted(icons_dir.glob('*.svg'))
    print(f"Found {len(svg_files)} SVG files. Processing...\n")

    output = {}

    for svg_path in svg_files:
        resco_name = svg_path.stem  # filename without .svg

        try:
            print(f"Processing: {resco_name}")

            # Extract PNG and open as image
            png_bytes = extract_png_from_svg(svg_path)
            image = Image.open(BytesIO(png_bytes))

            # Extract color palette
            palette = extract_color_palette(image, max_colors=5, min_pixels=100)

            output[resco_name] = {
                'colors': palette,
                'colorCount': len(palette)
            }

            print(f"  ✓ Found {len(palette)} colors\n")

        except Exception as e:
            print(f"  ✗ Error: {e}\n")

    # Write output to JSON file
    output_path = icons_dir / 'color-palettes.json'
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Color palettes saved to: {output_path}")
    print(f"\nSummary:")
    print(f"- Total rescos processed: {len(output)}")
    print(f"- Output file: color-palettes.json")

    # Print a sample
    if output:
        first_resco = list(output.keys())[0]
        print(f"\nExample ({first_resco}):")
        for color_info in output[first_resco]['colors']:
            print(f"  {color_info['color']} - {color_info['percentage']}%")

if __name__ == '__main__':
    main()
