import { rgbToCssString } from './colorUtils.js';
import { clearElement, createElement, createTextNode } from './utils.js';
import { NamedColor, getPresetNames, getPreset } from './namedColor.js';

/**
 * Create a color item element styled like palette colors
 * @param {NamedColor|null} color - The color to create an item for, or null for empty state
 * @returns {HTMLElement} The color item element
 */
export function createColorItem(color) {
  const item = createElement('div');
  item.className = 'color-item';

  // Color swatch
  const swatch = createElement('div');
  swatch.className = 'color-swatch';
  item.appendChild(swatch);

  if (!color) {
    return item;
  }

  // Valid color state

  swatch.classList.add('has-color');
  const cssColor = rgbToCssString(color.rgbColor);
  swatch.style.backgroundColor = cssColor;

  // Color info container
  const info = createElement('div');
  info.className = 'color-item-info';

  const name = createElement('div');
  name.className = 'color-name';
  name.appendChild(createTextNode(color ? color.name : 'No Palette'));

  const rgbValues = createElement('div');
  rgbValues.className = 'color-values';
  rgbValues.appendChild(createTextNode(color.rgbColor.toString()));

  info.appendChild(name);
  info.appendChild(rgbValues);

  item.appendChild(info);

  return item;
}

/**
 * Manages the color palette display and functionality
 */
export class ColorPalette {
  constructor(container) {
    this._colors = [];
    this.container = container;
    this._colorList = null;
    this._dropdown = null;
    this._initializeUI();
  }

  /**
   * Initialize the palette UI structure and controls
   */
  _initializeUI() {
    // Clear existing content
    clearElement(this.container);

    // Create title
    const title = createElement('h3', 'Color Palette');
    this.container.appendChild(title);

    // Create preset dropdown
    const dropdown = createElement('select');
    dropdown.className = 'palette-dropdown';
    this._dropdown = dropdown;

    // Add preset options
    getPresetNames().forEach(presetName => {
      const option = createElement('option', presetName);
      option.value = presetName;
      dropdown.appendChild(option);
    });

    // Add change event listener
    dropdown.addEventListener('change', (event) => {
      this._colors = [...getPreset(event.target.value)];
      this._renderColors();
    });

    this.container.appendChild(dropdown);

    // Create scrollable color list container
    this._colorList = createElement('div');
    this._colorList.className = 'color-list';
    this.container.appendChild(this._colorList);

    this._colors = [...getPreset(dropdown.value)];
    this._renderColors();
  }

  /**
   * Render the color list
   */
  _renderColors() {
    if (!this._colorList) {
      return;
    }

    clearElement(this._colorList);

    // Render each color
    for (const color of this._colors) {
      const colorItem = createColorItem(color);
      this._colorList.appendChild(colorItem);
    }
  }

  /**
   * Add a new color to the palette
   * @param {string} name - The name of the color
   * @param {RgbColor} color - RGB color instance
   */
  addColor(name, color) {
    const newColor = new NamedColor(name, color);
    this._colors.push(newColor);
    this._renderColors();
  }

  /**
   * Get all colors in the palette
   * @returns {Array<NamedColor>} Array of palette colors
   */
  getColors() {
    return [...this._colors];
  }
}
