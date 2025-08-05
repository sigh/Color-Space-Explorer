/**
 * Color conversion utilities
 * All internal RGB values use 0-1 range for consistency
 */

/**
 * Convert RGB (0-1) to 0-255 values for CSS/display
 * @param {number} r - Red (0-1)
 * @param {number} g - Green (0-1)
 * @param {number} b - Blue (0-1)
 * @returns {Object} RGB values {r, g, b} (0-255)
 */
export function rgbToBytes(r, g, b) {
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Convert HSV to RGB

/**
 * Convert HSV to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} v - Value (0-1)
 * @returns {Object} RGB values {r, g, b} (0-1)
 */
export function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r, g, b;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return {
    r: r + m,  // Return 0-1 values
    g: g + m,
    b: b + m
  };
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-1)
 * @param {number} g - Green (0-1)
 * @param {number} b - Blue (0-1)
 * @returns {Object} HSL values {h, s, l} - h: 0-360, s,l: 0-1
 */
export function rgbToHsl(r, g, b) {
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

  return {
    h: h * 360, // Keep hue in degrees
    s: s,       // Saturation as 0-1
    l: l        // Lightness as 0-1
  };
}

/**
 * Convert RGB to HSV
 * @param {number} r - Red (0-1)
 * @param {number} g - Green (0-1)
 * @param {number} b - Blue (0-1)
 * @returns {Object} HSV values {h, s, v} - h: 0-360, s,v: 0-1
 */
export function rgbToHsv(r, g, b) {
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

  return {
    h: h * 360, // Keep hue in degrees
    s: s,       // Saturation as 0-1
    v: v        // Value as 0-1
  };
}
