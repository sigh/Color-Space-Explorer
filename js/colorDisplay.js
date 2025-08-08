import { rgbToHsl, rgbToHsv, rgbToCssString } from './colorUtils.js';
import { clearElement, createTextNode } from './utils.js';
import { createColorItem } from './colorPalette.js';

/**
 * Handles color information display including hovered color and closest palette color
 */
export class ColorDisplay {
  constructor(container) {
    this._container = container;

    // Color display elements within the container
    this._colorSwatch = container.querySelector('.color-swatch');
    this._rgbData = container.querySelector('.rgb-data');
    this._hslData = container.querySelector('.hsl-data');
    this._hsvData = container.querySelector('.hsv-data');
    this._titleElement = container.querySelector('.color-info-title');

    // Closest color display element within the container
    this._closestColorContainer = container.querySelector('.closest-color-container');

    // Set default state
    this.clearColor();
  }

  /**
   * Set the selected color and update display accordingly
   * @param {RgbColor} rgbColor - RGB color instance with normalized coordinates
   * @param {NamedColor|null} closestColor - The closest palette color or null if no palette
   */
  setSelectedColor(rgbColor, closestColor) {
    this._setCurrentColor(rgbColor);
    this._setClosestColor(closestColor);
    this._setTitle(rgbColor, true);
  }

  /**
   * Set the color and update display accordingly
   * @param {RgbColor} rgbColor - RGB color instance with normalized coordinates
   * @param {NamedColor|null} closestColor - The closest palette color or null if no palette
   */
  setColor(rgbColor, closestColor) {
    this._setCurrentColor(rgbColor);
    this._setClosestColor(closestColor);
    this._setTitle(rgbColor, false);
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
   * Clear color displays when not hovering
   */
  clearColor() {
    this._setTitle(null, false);

    // Reset color swatch to empty state
    this._colorSwatch.classList.remove('has-color');

    // Clear color values with placeholder dashes
    clearElement(this._rgbData);
    clearElement(this._hslData);
    clearElement(this._hsvData);

    this._setClosestColor(null);
  }
}
