import { rgbToHsl, rgbToHsv, rgbToBytes } from './colorUtils.js';
import { clearElement, createTextNode, toIntPercentage, createElement } from './utils.js';
import { ColorSpaceView, getAllColorSpaces } from './colorSpace.js';
import { createColorItem } from './colorPalette.js';

/**
 * UI controller for updating color information display and handling axis controls
 */
export class UIController {
  constructor() {
    // Color display elements
    this._colorSwatch = document.querySelector('.color-swatch');
    this._rgbData = document.querySelector('.rgb-data');
    this._hslData = document.querySelector('.hsl-data');
    this._hsvData = document.querySelector('.hsv-data');

    // Closest color display element
    this._closestColorContainer = document.getElementById('closestColorContainer');

    // Axis control elements
    this._axisSlider = document.getElementById('axisSlider');
    this._axisValue = document.getElementById('axisValue');
    this._axisLabel = document.getElementById('axisLabel');

    // Color spaces
    this._colorSpaces = getAllColorSpaces();

    // Current palette colors for closest color lookup
    this._paletteColors = [];

    // Callback
    this._onColorSpaceChange = (colorSpaceView) => { }
  }

  /**
   * Set callback for color space changes
   * @param {Function} callback - Function to call when color space changes
   */
  setColorSpaceChangeCallback(callback) {
    this._onColorSpaceChange = callback;
  }

  /**
   * Set the current palette colors for closest color lookup
   * @param {Array<PaletteColor>} paletteColors - Array of palette colors
   */
  setPaletteColors(paletteColors) {
    this._paletteColors = paletteColors;
  }

  /**
   * Initialize axis controls
   * @param {ColorSpaceView} initialColorSpaceView - Initial color space view
   */
  setupAxisControls(initialColorSpaceView) {
    // Store references
    this._colorSpace = initialColorSpaceView.colorSpace;
    this._currentAxis = initialColorSpaceView.currentAxis;

    // Initialize color space buttons
    this._setupColorSpaceButtons();

    // Initialize axis buttons for the current color space
    this._updateAxisButtons();

    // Set up slider
    this._axisSlider.addEventListener('input', (event) => {
      const value = parseInt(event.target.value);
      const colorSpaceView = new ColorSpaceView(this._colorSpace, this._currentAxis, value);
      this._updateAxisDisplay(colorSpaceView);
      this._onColorSpaceChange(colorSpaceView);
    });

    // Initialize display
    this._updateAxisDisplay(initialColorSpaceView);

    // Notify change
    this._onColorSpaceChange(initialColorSpaceView);
  }

  /**
   * Update the color space buttons based on available color spaces
   */
  _setupColorSpaceButtons() {
    const colorSpaceSelector = document.querySelector('.color-space-selector');
    clearElement(colorSpaceSelector); // Clear existing buttons

    this._colorSpaces.forEach((colorSpace, index) => {
      const label = createElement('label');
      label.className = 'radio-button';

      const radio = createElement('input');
      radio.type = 'radio';
      radio.name = 'color-space';
      radio.value = colorSpace.getType();

      // Make the first button checked by default
      if (index === 0) {
        radio.checked = true;
      }

      const span = createElement('span', colorSpace.getType());

      label.appendChild(radio);
      label.appendChild(span);
      colorSpaceSelector.appendChild(label);

      // Attach event listener directly
      radio.addEventListener('change', () => {
        this._selectColorSpace(radio.value);
      });
    });
  }

  /**
   * Update the axis buttons based on the current color space
   */
  _updateAxisButtons() {
    const axisSelector = document.querySelector('.axis-selector');
    clearElement(axisSelector); // Clear existing buttons

    const axes = this._colorSpace.getAllAxes();
    const defaultAxis = this._colorSpace.getDefaultAxis();

    axes.forEach((axis) => {
      const label = createElement('label');
      label.className = 'radio-button';

      const radio = createElement('input');
      radio.type = 'radio';
      radio.name = 'axis';
      radio.value = axis.key;

      // Make the default axis checked by default
      if (axis === defaultAxis) {
        radio.checked = true;
      }

      const span = createElement('span', axis.name);

      label.appendChild(radio);
      label.appendChild(span);
      axisSelector.appendChild(label);

      // Attach event listener directly
      radio.addEventListener('change', () => {
        this._selectAxisByKey(radio.value);
      });
    });
  }

  /**
   * Select a new color space type
   * @param {string} colorSpaceType - Color space type to select (HSV or HSL)
   */
  _selectColorSpace(colorSpaceType) {
    // Update color space
    this._colorSpace = this._colorSpaces.find(cs => cs.getType() === colorSpaceType);

    // Update axis buttons for the new color space
    this._updateAxisButtons();

    // Reset to default axis
    const defaultAxis = this._colorSpace.getDefaultAxis();
    this._currentAxis = defaultAxis;

    // Create new color space view with default axis
    const colorSpaceView = new ColorSpaceView(
      this._colorSpace,
      defaultAxis,
      defaultAxis.defaultValue
    );
    // Update display
    this._updateAxisDisplay(colorSpaceView);

    // Notify change
    this._onColorSpaceChange(colorSpaceView);
  }

  /**
   * Select a specific axis by key
   * @param {string} axisKey - Key of axis to select
   */
  _selectAxisByKey(axisKey) {
    const axis = this._colorSpace.getAxisByKey(axisKey);
    this._currentAxis = axis;

    // Create color space view with new axis and its default value
    const colorSpaceView = new ColorSpaceView(this._colorSpace, axis, axis.defaultValue);

    // Update display
    this._updateAxisDisplay(colorSpaceView);

    // Notify change
    this._onColorSpaceChange(colorSpaceView);
  }

  /**
   * Update axis display elements
   * @param {ColorSpaceView} colorSpaceView - Color space view to display
   */
  _updateAxisDisplay(colorSpaceView) {
    const axis = colorSpaceView.currentAxis;

    // Update slider
    this._axisSlider.min = axis.min;
    this._axisSlider.max = axis.max;
    this._axisSlider.value = colorSpaceView.currentValue;

    // Update labels
    this._axisLabel.textContent = axis.name;
    this._axisValue.textContent = `${colorSpaceView.currentValue}${axis.unit}`;
  }

  /**
   * Update the hovered color display
   * @param {Object} rgbBytes - RGB color {r, g, b} (0-255 values)
   */
  updateHoveredColor(rgbBytes) {
    // Update color swatch
    this._colorSwatch.style.setProperty(
      '--swatch-color', `rgb(${rgbBytes.r}, ${rgbBytes.g}, ${rgbBytes.b})`);
    this._colorSwatch.classList.add('has-color');

    // Convert to other color spaces
    const rgb = {
      r: rgbBytes.r / 255,
      g: rgbBytes.g / 255,
      b: rgbBytes.b / 255
    };
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

    // Update color values using DOM methods (format for display)
    clearElement(this._rgbData);
    this._rgbData.appendChild(createTextNode(`${toIntPercentage(rgb.r)}%, ${toIntPercentage(rgb.g)}%, ${toIntPercentage(rgb.b)}%`));

    clearElement(this._hslData);
    this._hslData.appendChild(createTextNode(`${Math.round(hsl.h)}°, ${toIntPercentage(hsl.s)}%, ${toIntPercentage(hsl.l)}%`));

    clearElement(this._hsvData);
    this._hsvData.appendChild(createTextNode(`${Math.round(hsv.h)}°, ${toIntPercentage(hsv.s)}%, ${toIntPercentage(hsv.v)}%`));
  }

  /**
   * Update the closest color display
   * @param {PaletteColor|null} closestColor - The closest palette color or null if no palette
   */
  updateClosestColor(closestColor) {
    // Always clear and rebuild the container content
    clearElement(this._closestColorContainer);

    // Create a color item using the shared utility (handles null gracefully)
    const colorItem = createColorItem(closestColor);
    this._closestColorContainer.appendChild(colorItem);
  }

  /**
   * Clear color displays when not hovering
   */
  clearColors() {
    // Reset color swatch to empty state
    this._colorSwatch.classList.remove('has-color');

    // Clear color values with placeholder dashes
    clearElement(this._rgbData);
    clearElement(this._hslData);
    clearElement(this._hsvData);

    this.updateClosestColor(null);
  }
}
