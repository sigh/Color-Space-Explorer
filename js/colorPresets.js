import { PaletteColor } from './paletteColor.js';

/**
 * Predefined color palette presets
 */

export const ColorPresets = {
  'RGB Vertex Colors': [
    new PaletteColor('Red', { r: 1, g: 0, b: 0 }),
    new PaletteColor('Green', { r: 0, g: 1, b: 0 }),
    new PaletteColor('Blue', { r: 0, g: 0, b: 1 }),
    new PaletteColor('Yellow', { r: 1, g: 1, b: 0 }),
    new PaletteColor('Cyan', { r: 0, g: 1, b: 1 }),
    new PaletteColor('Magenta', { r: 1, g: 0, b: 1 }),
    new PaletteColor('White', { r: 1, g: 1, b: 1 }),
    new PaletteColor('Black', { r: 0, g: 0, b: 0 })
  ],

  'Basic Web Colors': [
    new PaletteColor('Black', { r: 0, g: 0, b: 0 }),
    new PaletteColor('Silver', { r: 0.75, g: 0.75, b: 0.75 }),
    new PaletteColor('Gray', { r: 0.5, g: 0.5, b: 0.5 }),
    new PaletteColor('White', { r: 1, g: 1, b: 1 }),
    new PaletteColor('Maroon', { r: 0.5, g: 0, b: 0 }),
    new PaletteColor('Red', { r: 1, g: 0, b: 0 }),
    new PaletteColor('Purple', { r: 0.5, g: 0, b: 0.5 }),
    new PaletteColor('Fuchsia', { r: 1, g: 0, b: 1 }),
    new PaletteColor('Green', { r: 0, g: 0.5, b: 0 }),
    new PaletteColor('Lime', { r: 0, g: 1, b: 0 }),
    new PaletteColor('Olive', { r: 0.5, g: 0.5, b: 0 }),
    new PaletteColor('Yellow', { r: 1, g: 1, b: 0 }),
    new PaletteColor('Navy', { r: 0, g: 0, b: 0.5 }),
    new PaletteColor('Blue', { r: 0, g: 0, b: 1 }),
    new PaletteColor('Teal', { r: 0, g: 0.5, b: 0.5 }),
    new PaletteColor('Aqua', { r: 0, g: 1, b: 1 })
  ]
};

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
 * @returns {Array<PaletteColor>} Array of palette colors
 */
export function getPreset(presetName) {
  return ColorPresets[presetName] || [];
}
