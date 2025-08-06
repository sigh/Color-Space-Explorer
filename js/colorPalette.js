import { rgbToBytes } from './colorUtils.js';
import { clearElement, createElement, createTextNode, toIntPercentage } from './utils.js';
import { PaletteColor } from './paletteColor.js';
import { getPresetNames, getPreset } from './colorPresets.js';

/**
 * Manages the color palette display and functionality
 */
export class ColorPalette {
  constructor(container) {
    this.colors = [];
    this.container = container;
    this.colorList = null;
    this.dropdown = null;
    this.initializeUI();
  }

  /**
   * Initialize the palette UI structure and controls
   */
  initializeUI() {
    // Clear existing content
    clearElement(this.container);

    // Create title
    const title = createElement('h3', 'Color Palette');
    this.container.appendChild(title);

    // Create preset dropdown
    const dropdown = createElement('select');
    dropdown.className = 'palette-dropdown';
    this.dropdown = dropdown;

    // Add preset options
    getPresetNames().forEach(presetName => {
      const option = createElement('option', presetName);
      option.value = presetName;
      dropdown.appendChild(option);
    });

    // Add change event listener
    dropdown.addEventListener('change', (event) => {
      this.colors = [...getPreset(event.target.value)];
      this.renderColors();
    });

    this.container.appendChild(dropdown);

    // Create scrollable color list container
    this.colorList = createElement('div');
    this.colorList.className = 'color-list';
    this.container.appendChild(this.colorList);

    this.colors = [...getPreset(dropdown.value)];
    this.renderColors();
  }

  /**
   * Render the color list
   */
  renderColors() {
    if (!this.colorList) {
      return;
    }

    clearElement(this.colorList);

    // Render each color
    this.colors.forEach((color, index) => {
      const colorItem = this.createColorItem(color, index);
      this.colorList.appendChild(colorItem);
    });
  }

  /**
   * Create a single color item element
   * @param {PaletteColor} color - The color to create an item for
   * @returns {HTMLElement} The color item element
   */
  createColorItem(color) {
    const item = createElement('div');
    item.className = 'color-item';

    // Color swatch - smaller for compact layout
    const swatch = createElement('div');
    swatch.className = 'color-swatch has-color';
    const rgbBytes = rgbToBytes(color.rgb.r, color.rgb.g, color.rgb.b);
    swatch.style.backgroundColor = `rgb(${rgbBytes.r}, ${rgbBytes.g}, ${rgbBytes.b})`;

    // Color info container for vertical layout
    const info = createElement('div');
    info.className = 'color-item-info';

    const name = createElement('div');
    name.className = 'color-name';
    name.appendChild(createTextNode(color.name));

    const rgbValues = createElement('div');
    rgbValues.className = 'color-values';
    rgbValues.appendChild(createTextNode(`RGB: ${toIntPercentage(color.rgb.r)}%, ${toIntPercentage(color.rgb.g)}%, ${toIntPercentage(color.rgb.b)}%`));

    info.appendChild(name);
    info.appendChild(rgbValues);

    item.appendChild(swatch);
    item.appendChild(info);

    return item;
  }

  /**
   * Add a new color to the palette
   * @param {string} name - The name of the color
   * @param {Object} rgb - RGB color {r, g, b} (0-1 values)
   */
  addColor(name, rgb) {
    const newColor = new PaletteColor(name, rgb);
    this.colors.push(newColor);
    this.renderColors();
  }

  /**
   * Get all colors in the palette
   * @returns {Array<PaletteColor>} Array of palette colors
   */
  getColors() {
    return [...this.colors];
  }
}
