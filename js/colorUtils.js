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
  // Reference: https://en.wikipedia.org/wiki/HSL_and_HSV#From_RGB
  const [r, g, b] = rgbColor;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // Lightness = mid(R, G, B)
  const l = (max + min) / 2;
  // Value = max(R, G, B)
  const v = max;
  // Saturation
  const sDenom = Math.min(l, 1 - l);
  const s = sDenom === 0 ? 0 : (v - l) / sDenom;
  // Hue
  const h = rgbToHue(r, g, b, min, max);

  return new HslColor(h, s, l);
}

/**
 * Convert RGB to HSV
 * @param {RgbColor} rgbColor - RGB color instance
 * @returns {HsvColor} HSV color instance
 */
export function rgbToHsv(rgbColor) {
  // Reference: https://en.wikipedia.org/wiki/HSL_and_HSV#From_RGB
  const [r, g, b] = rgbColor;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // Value = max(R, G, B)
  const v = max;

  // Chroma = range(R, G, B)
  const c = max - min;
  // Saturation = Chroma / Value (or 0 if Value is 0)
  const s = v === 0 ? 0 : c / v;
  // Hue
  const h = rgbToHue(r, g, b, min, max);

  return new HsvColor(h, s, v);
}

/**
 * Helper to calculate the hue component of an RGB color
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function rgbToHue(r, g, b, min, max) {
  // Reference: https://en.wikipedia.org/wiki/HSL_and_HSV#From_RGB

  const c = max - min;
  if (c === 0) return 0;

  let h;
  switch (max) {
    case r: h = (g - b) / c + (g < b ? 6 : 0); break;
    case g: h = (b - r) / c + 2; break;
    case b: h = (r - g) / c + 4; break;
  }
  return h / 6;
}