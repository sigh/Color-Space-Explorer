import { rgbToCssString } from './colorUtils.js';
import { clearElement, createElement, createTextNode } from './utils.js';
import { NamedColor, getPresetNames, getPreset } from './namedColor.js';

// Maximum palette colors (must match shader constant)
export const MAX_PALETTE_COLORS = 200;

/**
 * Create a color item element styled like palette colors
 * @param {NamedColor|null} color - The color to create an item for, or null for empty state
 * @param {Function} onDelete - Callback function for delete button click
 * @param {Function} onNameEdit - Callback function for name edit (color, newName)
 * @returns {HTMLElement} The color item element
 */
export function createColorItem(color, onDelete = null, onNameEdit = null) {
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

  // Make name editable if callback provided
  if (onNameEdit) {
    _setupNameEditing(name, color, onNameEdit);
  }

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

function _setupNameEditing(nameElement, color, onNameEdit) {
  nameElement.classList.add('editable');
  nameElement.contentEditable = true;
  nameElement.title = 'Click to edit name';

  // Handle editing events
  nameElement.addEventListener('blur', () => {
    const newName = nameElement.textContent.trim();
    if (newName && newName !== color.name) {
      onNameEdit(color, newName);
    } else {
      // Restore original name if invalid
      nameElement.textContent = color.name;
    }
  });

  nameElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameElement.blur(); // Trigger save
    } else if (e.key === 'Escape') {
      e.preventDefault();
      nameElement.textContent = color.name; // Restore original
      nameElement.blur();
    }
  });
}

/**
 * Manages the color palette display and functionality
 */
export class ColorPalette {
  constructor(container, addButton, colorDisplay, onUpdate = null) {
    this._colors = [];
    this.container = container;
    this._colorList = null;
    this._dropdown = null;
    this._addButton = addButton;
    this._colorDisplay = colorDisplay;
    this._onUpdate = onUpdate || (() => { });
    this._initializeUI();
    this._currentHighlight = null;
  }

  /**
   * Initialize the palette UI structure and controls
   */
  _initializeUI() {
    // Register with color display for button state changes
    this._colorDisplay.onColorChange(() => {
      this._updateAddButtonState();

      this._updateHighlightedColor();
    });

    // Clear existing content
    clearElement(this.container);

    // Create title
    const title = createElement('h2', 'Color Palette');
    this.container.appendChild(title);

    // Create container for dropdown and color count
    const paletteSelectContainer = createElement('div');
    paletteSelectContainer.className = 'palette-select-container';

    // Create preset dropdown
    const dropdown = this._makePaletteSelectDropdown();
    paletteSelectContainer.appendChild(dropdown);
    this._colors = [...getPreset(dropdown.value)];

    // Create color count display
    paletteSelectContainer.appendChild(this._makeCountDisplay());

    this.container.appendChild(paletteSelectContainer);

    // Create Add button
    this._addButton.style.visibility = 'hidden'; // Hidden but takes up space
    this._addButton.addEventListener('click', () => {
      if (this._colorDisplay.hasSelectedColor()) {
        this.addColor(...this._colorDisplay.getCurrentColors());
      }
    });

    // Create scrollable color list container
    this._colorList = createElement('div');
    this._colorList.className = 'palette-color-list';
    this.container.appendChild(this._colorList);

    this._renderColors();
  }

  _updateHighlightedColor() {
    const [_, closestColor] = this._colorDisplay.getCurrentColors();
    if (closestColor !== this._currentHighlight) {
      if (this._currentHighlight !== null) {
        this._getElementForColor(
          this._currentHighlight)?.classList.remove('color-item-highlighted');
      }
      if (closestColor !== null) {
        this._getElementForColor(
          closestColor)?.classList.add('color-item-highlighted');
      }
      this._currentHighlight = closestColor;
    }
  }

  /**
   * Get the DOM element representing a color in the palette
   * @param {NamedColor} color - The color object to find
   * @returns {HTMLElement|null} The color element or null if not found
   */
  _getElementForColor(color) {
    const index = this._colors.indexOf(color);
    if (index === -1) return null;
    return this._colorList.children[index];
  }

  /**
   * Create the palette select dropdown
   * @returns {HTMLElement} The dropdown element for selecting color palettes
   */
  _makePaletteSelectDropdown() {
    const dropdown = createElement('select');
    dropdown.className = 'palette-dropdown';
    this._dropdown = dropdown;

    // Add preset options
    getPresetNames().forEach(presetName => {
      const option = createElement('option', presetName);
      option.value = presetName;
      dropdown.appendChild(option);
    });

    // Add "Custom" option for modified palettes
    const customOption = createElement('option', 'Custom');
    customOption.value = 'custom';
    customOption.disabled = true;
    dropdown.appendChild(customOption);

    // Add change event listener
    dropdown.addEventListener('change', (event) => {
      this._colors = [...getPreset(event.target.value)];
      this._renderColors();
      this._onUpdate();
    });
    return dropdown;
  }

  /**
   * Creates the color count display element
   * @returns {HTMLElement} The count display element
   */

  _makeCountDisplay() {
    const countTextContainer = createElement('div');
    {
      const currentCount = createElement('div');
      currentCount.className = 'count-current';
      countTextContainer.appendChild(currentCount);
      this._countText = currentCount;

      const maxCount = createElement('div', `out of ${MAX_PALETTE_COLORS}`);
      maxCount.className = 'count-max';
      countTextContainer.appendChild(maxCount);
    }
    return countTextContainer;
  }

  /**
   * Render the color list
   */
  _renderColors() {
    clearElement(this._colorList);

    // Update color count display
    const count = this._colors.length;
    this._countText.textContent = `${count} color${count !== 1 ? 's' : ''}`;

    // Update button state based on current selection and limit
    this._updateAddButtonState();

    let highlightUnsetTimeout = null;

    // Render each color
    for (let i = 0; i < this._colors.length; i++) {
      const color = this._colors[i];
      const colorItem = createColorItem(
        color,
        this._deleteColor.bind(this),
        this._editColorName.bind(this)
      );

      // Add hover event listeners for highlighting
      colorItem.addEventListener('mouseenter', () => {
        window.clearTimeout(highlightUnsetTimeout);
        this._onUpdate({ highlightIndex: i });
      });

      colorItem.addEventListener('mouseleave', () => {
        window.clearTimeout(highlightUnsetTimeout);
        highlightUnsetTimeout = window.setTimeout(() => {
          this._onUpdate({ highlightIndex: null });
        }, 100); // Delay to avoid flickering
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
      this._setCustomState();
      this._renderColors();
      this._onUpdate();
    }
  }

  /**
   * Edit a color's name
   * @param {NamedColor} color - The color to edit
   * @param {string} newName - The new name for the color
   */
  _editColorName(color, newName) {
    const index = this._colors.indexOf(color);
    if (index !== -1 && newName.trim()) {
      // Update the color's name
      this._colors[index] = new NamedColor(newName.trim(), color.rgbColor);
      this._setCustomState();
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
    this._setCustomState();
    this._renderColors();
    this._onUpdate();

    // Highlight the newly added item
    const newItem = this._colorList.firstChild;
    if (newItem) {
      newItem.classList.add('newly-added');
      // Remove the highlight after animation
      setTimeout(() => {
        newItem.classList.remove('newly-added');
      }, 4000);
    }

    newItem.scrollIntoView({ behavior: 'smooth', block: 'start' });

    return true;
  }

  /**
   * Update add button state based on selection and color count
   */
  _updateAddButtonState() {
    const hasSelection = this._colorDisplay.hasSelectedColor();
    const isAtLimit = this._colors.length >= MAX_PALETTE_COLORS;

    const isEnabled = hasSelection && !isAtLimit;
    this._addButton.style.visibility = isEnabled ? 'visible' : 'hidden';
  }

  /**
   * Set the dropdown to "Custom" state when palette is modified
   */
  _setCustomState() {
    this._dropdown.value = 'custom';
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
