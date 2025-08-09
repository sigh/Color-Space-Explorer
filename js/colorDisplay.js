import { rgbToHsl, rgbToHsv, rgbToCssString } from './colorUtils.js';
import { clearElement, createTextNode } from './utils.js';
import { createColorItem } from './colorPalette.js';

/**
 * Handles color information display including hovered color and closest palette color
 */
export class ColorDisplay {
  constructor(container) {
    this._container = container;
    this._onColorChangeCallback = () => { };
    this._selectedColors = [null, null]; // [selectedColor, closestColor]

    // Color display elements within the container
    this._colorSwatch = container.querySelector('.color-swatch');
    this._rgbData = container.querySelector('.rgb-data');
    this._hslData = container.querySelector('.hsl-data');
    this._hsvData = container.querySelector('.hsv-data');
    this._titleElement = container.querySelector('.color-info-title');

    // Closest color display element within the container
    this._closestColorContainer = container.querySelector('.closest-color-container');
    this._setClosestColor(null);

    // Set default state
    this.clearColors();
  }

  /**
   * Set the selected color and update display accordingly
   * @param {RgbColor} rgbColor - RGB color instance with normalized coordinates
   * @param {NamedColor|null} closestColor - The closest palette color or null if no palette
   */
  setSelectedColors(rgbColor, closestColor) {
    this._selectedColors = [rgbColor, closestColor];
    this._setCurrentColor(rgbColor);
    this._setClosestColor(closestColor);
    this._setTitle(rgbColor, true);
    this._onColorChangeCallback();
  }

  /**
   * Set the color and update display accordingly
   * @param {RgbColor} rgbColor - RGB color instance with normalized coordinates
   * @param {NamedColor|null} closestColor - The closest palette color or null if no palette
   */
  setColors(rgbColor, closestColor) {
    this._selectedColors = [null, null];
    this._setCurrentColor(rgbColor);
    this._setClosestColor(closestColor);
    this._setTitle(rgbColor, false);
    this._onColorChangeCallback();
  }

  _setTitle(rgbColor, selected) {
    if (!rgbColor) {
      this._titleElement.textContent = 'No Color';
    } else {
      this._titleElement.textContent = selected ? 'Selected Color' : 'Current Color';
    }
  }

  /**
   * Set the current color display
   * @param {RgbColor} rgbColor - RGB color instance with normalized coordinates
   */
  _setCurrentColor(rgbColor) {
    // Convert to CSS string for display
    const cssColor = rgbToCssString(rgbColor);

    // Update color swatch
    this._colorSwatch.style.setProperty('--swatch-color', cssColor);
    this._colorSwatch.classList.add('has-color');

    // Convert to other color spaces
    const hslColor = rgbToHsl(rgbColor);
    const hsvColor = rgbToHsv(rgbColor);

    // Update color values using DOM methods (format for display)
    clearElement(this._rgbData);
    this._rgbData.appendChild(createTextNode(rgbColor.toString()));

    clearElement(this._hslData);
    this._hslData.appendChild(createTextNode(hslColor.toString()));

    clearElement(this._hsvData);
    this._hsvData.appendChild(createTextNode(hsvColor.toString()));
  }

  /**
   * Set the closest color display
   * @param {NamedColor|null} closestColor - The closest palette color or null if no palette
   */
  _setClosestColor(closestColor) {
    // Always clear and rebuild the container content
    clearElement(this._closestColorContainer);

    // Create a color item using the shared utility (handles null gracefully)
    const colorItem = createColorItem(closestColor);
    this._closestColorContainer.appendChild(colorItem);
  }

  /**
   * Clear color displays
   */
  clearColors() {
    if (!this._colorSwatch.classList.contains('has-color')) return;

    this._selectedColors = [null, null];
    this._setTitle(null, false);

    // Reset color swatch to empty state
    this._colorSwatch.classList.remove('has-color');

    // Clear color values with placeholder dashes
    clearElement(this._rgbData);
    clearElement(this._hslData);
    clearElement(this._hsvData);

    this._setClosestColor(null);
    this._onColorChangeCallback();
  }

  /**
   * Get the selected colors for adding to palette
   * @returns {Array} Array containing [selectedColor, closestColor] where selectedColor is RgbColor|null and closestColor is NamedColor|null
   */
  getSelectedColors() {
    return [...this._selectedColors];
  }

  /**
   * Register a callback for color change events
   * @param {Function} callback - Callback function that receives notification objects
   */
  onColorChange(callback) {
    this._onColorChangeCallback = callback;
  }
}
