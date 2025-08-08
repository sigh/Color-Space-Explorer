import { rgbToCssString } from './colorUtils.js';
import { clearElement, createElement, createTextNode } from './utils.js';
import { NamedColor, getPresetNames, getPreset } from './namedColor.js';

/**
 * Create a color item element styled like palette colors
 * @param {NamedColor|null} color - The color to create an item for, or null for empty state
 * @param {Function} onDelete - Callback function for delete button click
 * @returns {HTMLElement} The color item element
 */
export function createColorItem(color, onDelete = null) {
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

  // Add delete button if callback provided
  if (onDelete) {
    const deleteButton = createElement('button');
    deleteButton.className = 'color-delete-btn';
    deleteButton.innerHTML = '×';
    deleteButton.title = 'Delete color';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(color);
    });
    item.appendChild(deleteButton);
  }

  return item;
}

/**
 * Manages the color palette display and functionality
 */
export class ColorPalette {
  constructor(container, onUpdate = null) {
    this._colors = [];
    this.container = container;
    this._colorList = null;
    this._dropdown = null;
    this._colorCount = null;
    this._onUpdate = onUpdate || (() => { });
    this._initializeUI();
  }

  /**
   * Initialize the palette UI structure and controls
   */
  _initializeUI() {
    // Clear existing content
    clearElement(this.container);

    // Create title
    const title = createElement('h2', 'Color Palette');
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
      this._onUpdate();
    });

    this.container.appendChild(dropdown);

    // Create color count display
    this._colorCount = createElement('div');
    this._colorCount.className = 'color-count';
    this.container.appendChild(this._colorCount);

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
    clearElement(this._colorList);

    // Update color count display
    const count = this._colors.length;
    this._colorCount.textContent = `${count} color${count !== 1 ? 's' : ''}`;

    // Render each color
    for (let i = 0; i < this._colors.length; i++) {
      const color = this._colors[i];
      const colorItem = createColorItem(color, this._deleteColor.bind(this));

      // Add hover event listeners for highlighting
      colorItem.addEventListener('mouseenter', () => {
        this._onUpdate({ highlightIndex: i });
      });

      colorItem.addEventListener('mouseleave', () => {
        this._onUpdate({ highlightIndex: null, delayMs: 100 });
      });

      this._colorList.appendChild(colorItem);
    }
  }

  /**
   * Delete a color from the palette
   * @param {NamedColor} colorToDelete - The color object to delete
   */
  _deleteColor(colorToDelete) {
    const index = this._colors.indexOf(colorToDelete);
    if (index !== -1) {
      this._colors.splice(index, 1);
      this._renderColors();
      this._onUpdate();
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
    this._onUpdate();
  }

  /**
   * Get all colors in the palette
   * @returns {Array<NamedColor>} Array of palette colors
   */
  getColors() {
    return [...this._colors];
  }
}
