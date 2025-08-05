import { rgbToHsl, rgbToHsv, rgbToBytes } from './colorUtils.js';
import { clearElement, createTextNode, toIntPercentage } from './utils.js';

/**
 * UI controller for updating color information display
 */
export class UIController {
  constructor() {
    this.colorSwatch = document.querySelector('.color-swatch');
    this.rgbData = document.querySelector('.rgb-data');
    this.hslData = document.querySelector('.hsl-data');
    this.hsvData = document.querySelector('.hsv-data');
  }

  /**
   * Update the hovered color display
   * @param {Object} rgb - RGB color {r, g, b} (0-1 values)
   */
  updateHoveredColor(rgb) {
    // Convert to bytes for CSS
    const rgbBytes = rgbToBytes(rgb.r, rgb.g, rgb.b);

    // Update color swatch
    this.colorSwatch.style.backgroundColor = `rgb(${rgbBytes.r}, ${rgbBytes.g}, ${rgbBytes.b})`;

    // Hide the indicator dot when showing color
    this.colorSwatch.style.setProperty('--show-indicator', '0');

    // Convert to other color spaces
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

    // Update color values using DOM methods (format for display)
    clearElement(this.rgbData);
    this.rgbData.appendChild(createTextNode(`${toIntPercentage(rgb.r)}%, ${toIntPercentage(rgb.g)}%, ${toIntPercentage(rgb.b)}%`));

    clearElement(this.hslData);
    this.hslData.appendChild(createTextNode(`${Math.round(hsl.h)}°, ${toIntPercentage(hsl.s)}%, ${toIntPercentage(hsl.l)}%`));

    clearElement(this.hsvData);
    this.hsvData.appendChild(createTextNode(`${Math.round(hsv.h)}°, ${toIntPercentage(hsv.s)}%, ${toIntPercentage(hsv.v)}%`));
  }

  /**
   * Clear color display when not hovering
   */
  clearHoveredColor() {
    // Reset color swatch to empty state
    this.colorSwatch.style.backgroundColor = 'transparent';
    this.colorSwatch.style.opacity = '1';

    // Show the indicator dot when no color
    this.colorSwatch.style.setProperty('--show-indicator', '0.5');

    // Clear color values with placeholder dashes
    clearElement(this.rgbData);
    this.rgbData.appendChild(createTextNode('—'));

    clearElement(this.hslData);
    this.hslData.appendChild(createTextNode('—'));

    clearElement(this.hsvData);
    this.hsvData.appendChild(createTextNode('—'));
  }

  /**
   * Set default color display
   */
  setDefaultColor() {
    this.clearHoveredColor();
  }
}
