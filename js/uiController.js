import { rgbToHsl, rgbToHsv, rgbToBytes } from './colorUtils.js';
import { clearElement, createTextNode, toIntPercentage } from './utils.js';
import { ColorSpaceView } from './colorSpace.js';

/**
 * UI controller for updating color information display and handling axis controls
 */
export class UIController {
  constructor() {
    // Color display elements
    this.colorSwatch = document.querySelector('.color-swatch');
    this.rgbData = document.querySelector('.rgb-data');
    this.hslData = document.querySelector('.hsl-data');
    this.hsvData = document.querySelector('.hsv-data');

    // Axis control elements
    this.axisSlider = document.getElementById('axisSlider');
    this.axisValue = document.getElementById('axisValue');
    this.axisLabel = document.getElementById('axisLabel');
    this.axisButtons = document.querySelectorAll('.axis-button');

    // Callback for when color space changes
    this.onColorSpaceChange = null;
  }

  /**
   * Set callback for color space changes
   * @param {Function} callback - Function to call when color space changes
   */
  setColorSpaceChangeCallback(callback) {
    this.onColorSpaceChange = callback;
  }

  /**
   * Initialize axis controls
   * @param {HsvColorSpace} hsvColorSpace - HSV color space configuration
   * @param {ColorSpaceView} initialColorSpaceView - Initial color space view
   */
  setupAxisControls(hsvColorSpace, initialColorSpaceView) {
    // Store references
    this.hsvColorSpace = hsvColorSpace;
    let currentAxis = initialColorSpaceView.getCurrentAxis();

    // Set up axis selection buttons
    this.axisButtons.forEach(button => {
      button.addEventListener('click', () => {
        currentAxis = button.dataset.axis;
        this.selectAxis(button.dataset.axis);
      });
    });

    // Set up slider
    this.axisSlider.addEventListener('input', (event) => {
      const value = parseInt(event.target.value);
      const colorSpaceView = new ColorSpaceView(currentAxis, value);
      this.updateAxisDisplay(colorSpaceView);
      if (this.onColorSpaceChange) {
        this.onColorSpaceChange(colorSpaceView);
      }
    });

    // Initialize display
    this.updateAxisDisplay(initialColorSpaceView);
  }

  /**
   * Select a new axis
   * @param {string} axis - Axis to select
   */
  selectAxis(axis) {
    // Update active button
    this.axisButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-axis="${axis}"]`).classList.add('active');

    // Create color space view with new axis and its default value
    const defaultValue = this.hsvColorSpace.getDefaultValue(axis);
    const colorSpaceView = new ColorSpaceView(axis, defaultValue);

    // Update display
    this.updateAxisDisplay(colorSpaceView);

    // Notify change
    if (this.onColorSpaceChange) {
      this.onColorSpaceChange(colorSpaceView);
    }
  }

  /**
   * Update axis display elements
   * @param {ColorSpaceView} colorSpaceView - Color space view to display
   */
  updateAxisDisplay(colorSpaceView) {
    const config = this.hsvColorSpace.getAxisConfig(colorSpaceView.getCurrentAxis());

    // Update slider
    this.axisSlider.min = config.min;
    this.axisSlider.max = config.max;
    this.axisSlider.value = colorSpaceView.getCurrentValue();

    // Update labels
    this.axisLabel.textContent = config.name;
    this.axisValue.textContent = `${colorSpaceView.getCurrentValue()}${config.unit}`;
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
