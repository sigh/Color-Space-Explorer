import { RgbColor, HslColor, HsvColor } from './colorSpace.js';

/**
 * Color conversion utilities
 * All internal RGB values use 0-1 range for consistency
 */

/**
 * Convert RGB color to CSS rgb() string
 * @param {RgbColor} rgbColor - RGB color instance
 * @returns {string} CSS rgb() string (e.g., "rgb(255, 128, 0)")
 */
export function rgbToCssString(rgbColor) {
  const [r, g, b] = rgbColor;
  const rByte = Math.round(r * 255);
  const gByte = Math.round(g * 255);
  const bByte = Math.round(b * 255);
  return `rgb(${rByte}, ${gByte}, ${bByte})`;
}

/**
 * Convert RGB to HSL
 * @param {RgbColor} rgbColor - RGB color instance
 * @returns {HslColor} HSL color instance
 */
export function rgbToHsl(rgbColor) {
  const [r, g, b] = rgbColor;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return new HslColor(h, s, l);
}

/**
 * Convert RGB to HSV
 * @param {RgbColor} rgbColor - RGB color instance
 * @returns {HsvColor} HSV color instance
 */
export function rgbToHsv(rgbColor) {
  const [r, g, b] = rgbColor;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return new HsvColor(h, s, v);
}
