import { rgbToCssString } from './colorUtils.js';
import { clearElement, createElement, createTextNode } from './utils.js';
import { NamedColor, getPresetNames, getPreset } from './namedColor.js';

// Maximum palette colors (must match shader constant)
const MAX_PALETTE_COLORS = 200;

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
  constructor(container, colorDisplay, onUpdate = null) {
    this._colors = [];
    this.container = container;
    this._colorList = null;
    this._dropdown = null;
    this._colorCount = null;
    this._addButton = null;
    this._colorDisplay = colorDisplay;
    this._onUpdate = onUpdate || (() => { });
    this._initializeUI();
  }

  /**
   * Initialize the palette UI structure and controls
   */
  _initializeUI() {
    // Register with color display for button state changes
    this._colorDisplay.onColorChange(() => {
      this._updateAddButtonState();
    });

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

    // Create color count display with inline Add button
    this._colorCount = createElement('div');
    this._colorCount.className = 'color-count';

    // Create Add button (positioned first, to the left)
    this._addButton = createElement('button', 'Add selected color');
    this._addButton.className = 'add-color-btn';
    this._addButton.style.visibility = 'hidden'; // Hidden but takes up space
    this._addButton.addEventListener('click', () => {
      this.addColor(...this._colorDisplay.getSelectedColors());
    });
    this._colorCount.appendChild(this._addButton);

    this._countText = createElement('span', '0 colors');
    this._colorCount.appendChild(this._countText);

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

    // Update color count display with max limit
    const count = this._colors.length;
    this._countText.textContent = `${count}/${MAX_PALETTE_COLORS} color${count !== 1 ? 's' : ''}`;

    // Update button state based on current selection and limit
    this._updateAddButtonState();

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
   * Add a color with automatic naming
   * @param {RgbColor} rgbColor - RGB color instance
   * @param {NamedColor|null} closestColor - Closest color for naming
   * @returns {boolean} True if added, false if at limit
   */
  addColor(rgbColor, closestColor) {
    if (!rgbColor) return false;
    if (this._colors.length >= MAX_PALETTE_COLORS) return false;

    const name = this._generateColorName(rgbColor, closestColor);

    this._colors.unshift(new NamedColor(name, rgbColor));
    this._renderColors();
    this._onUpdate();
    this._colorList.firstChild.scrollIntoView(
      { behavior: 'smooth', block: 'start' });

    return true;
  }

  /**
   * Update add button state based on selection and color count
   */
  _updateAddButtonState() {
    const [selectedColor] = this._colorDisplay.getSelectedColors();
    const hasSelection = !!selectedColor;
    const isAtLimit = this._colors.length >= MAX_PALETTE_COLORS;

    // Button is visible when there's a selection
    this._addButton.style.visibility = hasSelection ? 'visible' : 'hidden';

    // Button is enabled when there's a selection AND we're not at the limit
    const isEnabled = hasSelection && !isAtLimit;
    this._addButton.disabled = !isEnabled;
  }

  /**
   * Generate a unique name for a color based on closest match
   * @param {RgbColor} rgbColor - RGB color instance
   * @param {NamedColor|null} closestColor - Closest color match or null
   * @returns {string} Generated unique color name
   */
  _generateColorName(rgbColor, closestColor) {
    const currentClosestName = closestColor ? closestColor.name : 'Custom';

    // Strip of any trailing number in parentheses
    const baseName = currentClosestName.replace(/\s*\(\d+\)$/, '');

    // Find any existing colors with the same base name, and find the lowest
    // unused number to append
    let lowestUnused = 1;
    for (const color of this._colors) {
      if (color.name.startsWith(baseName)) {
        const match = color.name.match(/\s*\((\d+)\)$/);
        if (match && color.name.length === baseName.length + match[0].length) {
          lowestUnused = Math.max(lowestUnused, parseInt(match[1], 10) + 1);
        }
      }
    }

    return `${baseName} (${lowestUnused})`;
  }

  /**
   * Get all colors in the palette
   * @returns {Array<NamedColor>} Array of palette colors
   */
  getColors() {
    return [...this._colors];
  }
}
