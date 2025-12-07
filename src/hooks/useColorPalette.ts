import { useState, useEffect } from 'react';
import {
  loadColorPalettes,
  getPaletteForButtery,
  getBestContrastingPair,
  getHighContrastColors,
  isDarkColor,
  getBestTextColor,
  hexToTailwindRgb,
  getRelativeLuminance,
  hexToRgb,
  type ColorPalettes,
} from '../utils/colorPalette';

export interface ColorPaletteResult {
  primaryColor: string;
  accentColor: string;
  isDarkPrimary: boolean;
  textColor: string;
  rgbPrimary: string;
  rgbAccent: string;
  // Multiple contrast colors for different UI elements
  contrastColors: string[];
  // Light variants for buttons/badges (at least 2 if available)
  lightColors: string[];
  darkColors: string[];
  isLoading: boolean;
  error: Error | null;
}

const DEFAULT_BLUEBITE_PRIMARY = '#0066FF';
const DEFAULT_BLUEBITE_ACCENT = '#003DB3';
const DEFAULT_BLUEBITE_LIGHT = '#4D99FF';

/**
 * Creates a default color palette result using BlueBite brand colors.
 */
function getDefaultPalette(): Omit<ColorPaletteResult, 'isLoading' | 'error'> {
  return {
    primaryColor: DEFAULT_BLUEBITE_PRIMARY,
    accentColor: DEFAULT_BLUEBITE_ACCENT,
    isDarkPrimary: isDarkColor(DEFAULT_BLUEBITE_PRIMARY),
    textColor: getBestTextColor(DEFAULT_BLUEBITE_PRIMARY),
    rgbPrimary: hexToTailwindRgb(DEFAULT_BLUEBITE_PRIMARY),
    rgbAccent: hexToTailwindRgb(DEFAULT_BLUEBITE_ACCENT),
    contrastColors: [DEFAULT_BLUEBITE_ACCENT],
    lightColors: [DEFAULT_BLUEBITE_LIGHT],
    darkColors: [DEFAULT_BLUEBITE_PRIMARY, DEFAULT_BLUEBITE_ACCENT],
  };
}

/**
 * React hook that provides dynamic color palette based on selected buttery.
 *
 * Features:
 * - Loads color palettes from JSON on first mount
 * - Caches palette data in localStorage
 * - Returns buttery-specific colors or fallback to BlueBite defaults
 * - Automatically calculates contrast ratios and text colors
 * - Provides loading and error states
 *
 * @param selectedButtery - The name of the currently selected buttery (null for all butteries)
 * @returns ColorPaletteResult object with colors and metadata
 *
 * @example
 * ```tsx
 * const { primaryColor, accentColor, textColor, rgbPrimary } = useColorPalette('Benjamin Franklin');
 *
 * <div style={{ backgroundColor: primaryColor, color: textColor }}>
 *   Header content
 * </div>
 * ```
 */
export function useColorPalette(selectedButtery: string | null): ColorPaletteResult {
  const [palettes, setPalettes] = useState<ColorPalettes | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Load color palettes on mount
  useEffect(() => {
    let isMounted = true;

    const fetchPalettes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await loadColorPalettes();

        if (isMounted) {
          setPalettes(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error('Failed to load color palettes');
          setError(error);
          setIsLoading(false);
          console.error('Error loading color palettes:', error);
        }
      }
    };

    fetchPalettes();

    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate colors based on selected buttery
  const paletteData = (() => {
    const defaultPalette = getDefaultPalette();

    // If still loading or error occurred, return defaults
    if (isLoading || error || !palettes) {
      return defaultPalette;
    }

    // If no buttery selected, return defaults
    if (!selectedButtery) {
      return defaultPalette;
    }

    // Get palette for selected buttery
    const butteryPalette = getPaletteForButtery(palettes, selectedButtery);

    // If buttery not found in palettes, return defaults
    if (!butteryPalette) {
      console.warn(`Color palette not found for buttery: ${selectedButtery}`);
      return defaultPalette;
    }

    // Get best contrasting color pair
    const { primaryColor, accentColor } = getBestContrastingPair(butteryPalette);

    // Get all high-contrast colors and separate by lightness
    const contrastColors = getHighContrastColors(butteryPalette);
    const lightColors: string[] = [];
    const darkColors: string[] = [];

    // Separate colors by luminance for different use cases
    for (const color of contrastColors) {
      const rgb = hexToRgb(color);
      const luminance = getRelativeLuminance(rgb);
      if (luminance < 0.5) {
        darkColors.push(color);
      } else {
        lightColors.push(color);
      }
    }

    // Ensure we have at least one of each, using primary/accent as fallback
    if (lightColors.length === 0) {
      lightColors.push(accentColor);
    }
    if (darkColors.length === 0) {
      darkColors.push(primaryColor);
    }

    // Calculate derived properties
    const isDarkPrimary = isDarkColor(primaryColor);
    const textColor = getBestTextColor(primaryColor);
    const rgbPrimary = hexToTailwindRgb(primaryColor);
    const rgbAccent = hexToTailwindRgb(accentColor);

    return {
      primaryColor,
      accentColor,
      isDarkPrimary,
      textColor,
      rgbPrimary,
      rgbAccent,
      contrastColors,
      lightColors,
      darkColors,
    };
  })();

  return {
    ...paletteData,
    isLoading,
    error,
  };
}
