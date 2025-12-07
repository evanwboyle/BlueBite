/**
 * Color Palette Utility
 *
 * Provides functions for loading, analyzing, and managing color palettes
 * from buttery icons. Includes contrast calculation and color manipulation
 * utilities for dynamic theming.
 */

export interface ColorEntry {
  color: string; // Hex color (e.g., "#F01E2D")
  pixelCount: number;
  percentage: number;
}

export interface ButteryPalette {
  colors: ColorEntry[];
  colorCount: number;
}

export interface ColorPalettes {
  [butteryName: string]: ButteryPalette;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

const CACHE_KEY = 'bluebite_color_palettes';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_BLUEBITE_COLOR = '#0066FF';
const CONTRAST_THRESHOLD = 4.5; // WCAG AA standard
const MIN_CONTRAST_FOR_PAIRING = 3.0; // Minimum for accent pairing

/**
 * Loads color palette data from the JSON file.
 * Uses localStorage caching to avoid repeated network requests.
 */
export async function loadColorPalettes(): Promise<ColorPalettes> {
  // Check cache first
  const cached = getCachedPalettes();
  if (cached) {
    return cached;
  }

  // Fetch from JSON file
  try {
    const response = await fetch('/assets/resco-icons/color-palettes.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch color palettes: ${response.statusText}`);
    }

    const palettes = await response.json() as ColorPalettes;

    // Cache the result
    cachePalettes(palettes);

    return palettes;
  } catch (error) {
    console.error('Error loading color palettes:', error);
    throw error;
  }
}

/**
 * Retrieves cached color palettes from localStorage if valid.
 */
function getCachedPalettes(): ColorPalettes | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return null;
    }

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    if (now - timestamp > CACHE_DURATION_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data as ColorPalettes;
  } catch (error) {
    console.error('Error reading cached palettes:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Caches color palettes to localStorage with timestamp.
 */
function cachePalettes(palettes: ColorPalettes): void {
  try {
    const cacheEntry = {
      data: palettes,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error('Error caching palettes:', error);
  }
}

/**
 * Converts a hex color string to RGB values.
 */
export function hexToRgb(hex: string): RGBColor {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex string
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return { r, g, b };
}

/**
 * Converts RGB color to Tailwind CSS RGB format (space-separated values).
 * Example: { r: 240, g: 30, b: 45 } -> "240 30 45"
 */
export function rgbToTailwindRgb(rgb: RGBColor): string {
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

/**
 * Converts hex color directly to Tailwind RGB string.
 */
export function hexToTailwindRgb(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgbToTailwindRgb(rgb);
}

/**
 * Calculates the relative luminance of a color according to WCAG standards.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getRelativeLuminance(rgb: RGBColor): number {
  const { r, g, b } = rgb;

  // Normalize RGB values
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  // Apply gamma correction
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates contrast ratio between two colors according to WCAG standards.
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determines if a color is considered "dark" based on its luminance.
 * Uses the relative luminance threshold of 0.5.
 */
export function isDarkColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  const luminance = getRelativeLuminance(rgb);
  return luminance < 0.5;
}

/**
 * Determines the best text color (white or black) for a given background color
 * based on contrast ratios.
 */
export function getBestTextColor(backgroundColor: string): string {
  const whiteContrast = getContrastRatio(backgroundColor, '#FFFFFF');
  const blackContrast = getContrastRatio(backgroundColor, '#000000');

  return whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
}

/**
 * Gets all high-contrast colors from a palette, sorted by quality score.
 * Filters to usable colors (not near-white) with minimum contrast ratio.
 * Returns colors that can be used for different UI elements.
 */
export function getHighContrastColors(palette: ButteryPalette): string[] {
  if (!palette.colors || palette.colors.length === 0) {
    return [DEFAULT_BLUEBITE_COLOR];
  }

  const primaryColor = palette.colors[0].color;
  const candidates: { color: string; contrast: number; score: number }[] = [];

  for (let i = 1; i < palette.colors.length; i++) {
    const entry = palette.colors[i];
    const rgb = hexToRgb(entry.color);
    const luminance = getRelativeLuminance(rgb);

    // Skip near-white colors (luminance > 0.9)
    if (luminance > 0.9) {
      continue;
    }

    // Calculate contrast with primary
    const contrast = getContrastRatio(primaryColor, entry.color);

    // Only include colors with meaningful contrast
    if (contrast < MIN_CONTRAST_FOR_PAIRING) {
      continue;
    }

    // Score based on contrast (80%) and percentage (20%)
    const percentageScore = entry.percentage / 100;
    const score = (contrast * 0.8) + (percentageScore * 0.2);

    candidates.push({
      color: entry.color,
      contrast,
      score,
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Return just the colors, up to 3
  return candidates.slice(0, 3).map(c => c.color);
}

/**
 * Finds the best contrasting color pair from a palette.
 * Returns the most common color as primary and the best contrasting color as accent.
 */
export function getBestContrastingPair(palette: ButteryPalette): {
  primaryColor: string;
  accentColor: string;
} {
  const colors = getHighContrastColors(palette);
  return {
    primaryColor: palette.colors[0]?.color || DEFAULT_BLUEBITE_COLOR,
    accentColor: colors[0] || DEFAULT_BLUEBITE_COLOR,
  };
}

/**
 * Gets a palette for a specific buttery by name.
 * Returns null if the buttery is not found.
 */
export function getPaletteForButtery(
  palettes: ColorPalettes,
  butteryName: string | null
): ButteryPalette | null {
  if (!butteryName) {
    return null;
  }

  return palettes[butteryName] || null;
}

/**
 * Filters out white and near-white colors from a palette.
 * Useful for getting colors suitable for UI elements.
 */
export function filterNonWhiteColors(palette: ButteryPalette): ColorEntry[] {
  return palette.colors.filter(entry => {
    const rgb = hexToRgb(entry.color);
    const luminance = getRelativeLuminance(rgb);
    return luminance < 0.9; // Exclude very light colors
  });
}

/**
 * Validates that a color has sufficient contrast against a background
 * for text readability (WCAG AA standard).
 */
export function hasAccessibleContrast(
  textColor: string,
  backgroundColor: string
): boolean {
  const contrast = getContrastRatio(textColor, backgroundColor);
  return contrast >= CONTRAST_THRESHOLD;
}
