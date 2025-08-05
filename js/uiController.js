import { rgbToHsl, rgbToHsv } from './colorUtils.js';
import { clearElement, createTextNode, toIntPercentage, createElement } from './utils.js';
import { ColorSpaceView, getAllColorSpaces } from './colorSpace.js';

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

    // Color spaces
    this.colorSpaces = getAllColorSpaces();

    // Callback
    this.onColorSpaceChange = (colorSpaceView) => { }
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
   * @param {ColorSpaceView} initialColorSpaceView - Initial color space view
   */
  setupAxisControls(initialColorSpaceView) {
    // Store references
    this.colorSpace = initialColorSpaceView.colorSpace;
    this.currentAxis = initialColorSpaceView.currentAxis;

    // Initialize color space buttons
    this.setupColorSpaceButtons();

    // Initialize axis buttons for the current color space
    this.updateAxisButtons();

    // Set up slider
    this.axisSlider.addEventListener('input', (event) => {
      const value = parseInt(event.target.value);
      const colorSpaceView = new ColorSpaceView(this.colorSpace, this.currentAxis, value);
      this.updateAxisDisplay(colorSpaceView);
      this.onColorSpaceChange(colorSpaceView);
    });

    // Initialize display
    this.updateAxisDisplay(initialColorSpaceView);

    // Notify change
    this.onColorSpaceChange(initialColorSpaceView);
  }

  /**
   * Update the color space buttons based on available color spaces
   */
  setupColorSpaceButtons() {
    const colorSpaceSelector = document.querySelector('.color-space-selector');
    clearElement(colorSpaceSelector); // Clear existing buttons

    this.colorSpaces.forEach((colorSpace, index) => {
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
        this.selectColorSpace(radio.value);
      });
    });
  }

  /**
 * Update the axis buttons based on the current color space
 */
  updateAxisButtons() {
    const axisSelector = document.querySelector('.axis-selector');
    clearElement(axisSelector); // Clear existing buttons

    const axes = this.colorSpace.getAllAxes();
    const defaultAxis = this.colorSpace.getDefaultAxis();

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
        this.selectAxisByKey(radio.value);
      });
    });
  }

  /**
   * Select a new color space type
   * @param {string} colorSpaceType - Color space type to select (HSV or HSL)
   */
  selectColorSpace(colorSpaceType) {
    // Update color space
    this.colorSpace = this.colorSpaces.find(cs => cs.getType() === colorSpaceType);

    // Update axis buttons for the new color space
    this.updateAxisButtons();

    // Reset to default axis
    const defaultAxis = this.colorSpace.getDefaultAxis();
    this.currentAxis = defaultAxis;

    // Create new color space view with default axis
    const colorSpaceView = new ColorSpaceView(
      this.colorSpace,
      defaultAxis,
      defaultAxis.defaultValue
    );
    // Update display
    this.updateAxisDisplay(colorSpaceView);

    // Notify change
    this.onColorSpaceChange(colorSpaceView);
  }

  /**
   * Select a specific axis by key
   * @param {string} axisKey - Key of axis to select
   */
  selectAxisByKey(axisKey) {
    const axis = this.colorSpace.getAxisByKey(axisKey);
    this.currentAxis = axis;

    // Create color space view with new axis and its default value
    const colorSpaceView = new ColorSpaceView(this.colorSpace, axis, axis.defaultValue);

    // Update display
    this.updateAxisDisplay(colorSpaceView);

    // Notify change
    this.onColorSpaceChange(colorSpaceView);
  }

  /**
   * Update axis display elements
   * @param {ColorSpaceView} colorSpaceView - Color space view to display
   */
  updateAxisDisplay(colorSpaceView) {
    const axis = colorSpaceView.currentAxis;

    // Update slider
    this.axisSlider.min = axis.min;
    this.axisSlider.max = axis.max;
    this.axisSlider.value = colorSpaceView.currentValue;

    // Update labels
    this.axisLabel.textContent = axis.name;
    this.axisValue.textContent = `${colorSpaceView.currentValue}${axis.unit}`;
  }

  /**
   * Update the hovered color display
   * @param {Object} rgbBytes - RGB color {r, g, b} (0-255 values)
   */
  updateHoveredColor(rgbBytes) {
    // Update color swatch
    this.colorSwatch.style.setProperty(
      '--swatch-color', `rgb(${rgbBytes.r}, ${rgbBytes.g}, ${rgbBytes.b})`);
    this.colorSwatch.classList.add('has-color');

    // Convert to other color spaces
    const rgb = {
      r: rgbBytes.r / 255,
      g: rgbBytes.g / 255,
      b: rgbBytes.b / 255
    };
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
    this.colorSwatch.classList.remove('has-color');

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
