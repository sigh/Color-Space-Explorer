import { RgbColor } from './colorSpace.js';

/**
 * Represents a single color in the palette
 */
export class NamedColor {
  constructor(name, rgbColor) {
    this.name = name;
    this.rgbColor = rgbColor;
    Object.freeze(this);
  }
}

/**
 * Get all available preset names
 * @returns {Array<string>} Array of preset names
 */
export function getPresetNames() {
  return Object.keys(ColorPresets);
}

/**
 * Get a preset by name
 * @param {string} presetName - Name of the preset
 * @returns {Array<NamedColor>} Array of palette colors
 */
export function getPreset(presetName) {
  return ColorPresets[presetName] || [];
}

/**
 * Convert hex color string to RgbColor instance
 * @param {string} hex - Hex color string (e.g., '#FF0000')
 * @returns {RgbColor} RGB color instance
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new RgbColor(r, g, b);
}

/**
 * Predefined color palette presets
 */
const ColorPresets = {
  'RGB Vertex Colors': [
    new NamedColor('Red', hexToRgb('#FF0000')),
    new NamedColor('Green', hexToRgb('#00FF00')),
    new NamedColor('Blue', hexToRgb('#0000FF')),
    new NamedColor('Yellow', hexToRgb('#FFFF00')),
    new NamedColor('Cyan', hexToRgb('#00FFFF')),
    new NamedColor('Magenta', hexToRgb('#FF00FF')),
    new NamedColor('White', hexToRgb('#FFFFFF')),
    new NamedColor('Black', hexToRgb('#000000'))
  ],

  'Basic Web Colors': [
    new NamedColor('Black', hexToRgb('#000000')),
    new NamedColor('Silver', hexToRgb('#C0C0C0')),
    new NamedColor('Gray', hexToRgb('#808080')),
    new NamedColor('White', hexToRgb('#FFFFFF')),
    new NamedColor('Maroon', hexToRgb('#800000')),
    new NamedColor('Red', hexToRgb('#FF0000')),
    new NamedColor('Purple', hexToRgb('#800080')),
    new NamedColor('Fuchsia', hexToRgb('#FF00FF')),
    new NamedColor('Green', hexToRgb('#008000')),
    new NamedColor('Lime', hexToRgb('#00FF00')),
    new NamedColor('Olive', hexToRgb('#808000')),
    new NamedColor('Yellow', hexToRgb('#FFFF00')),
    new NamedColor('Navy', hexToRgb('#000080')),
    new NamedColor('Blue', hexToRgb('#0000FF')),
    new NamedColor('Teal', hexToRgb('#008080')),
    new NamedColor('Aqua', hexToRgb('#00FFFF'))
  ]
};