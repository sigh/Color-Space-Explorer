import { clearElement, createElement } from './utils.js';
import { ColorSpaceView, getAllColorSpaces, getColorSpaceByType } from './colorSpace.js';

/**
 * UI controller for handling axis controls and boundaries toggle
 */
export class UIController {
  constructor(initialColorSpaceView, onColorSpaceChange) {
    // Axis control elements
    this._axisSlider = document.getElementById('axisSlider');
    this._axisValue = document.getElementById('axisValue');
    this._axisLabel = document.getElementById('axisLabel');

    // Boundaries toggle element
    this._boundariesToggle = document.getElementById('boundariesToggle');

    // Callback
    this._onColorSpaceChange = onColorSpaceChange;

    // Initialize the UI with the provided color space view
    this._boundariesToggle.addEventListener('change', () => {
      this._triggerUpdate();
    });
    this._setupAxisControls(initialColorSpaceView);
  }

  /**
   * Initialize axis controls
   * @param {ColorSpaceView} initialColorSpaceView - Initial color space view
   */
  _setupAxisControls(initialColorSpaceView) {
    // Store references
    this._colorSpace = initialColorSpaceView.colorSpace;
    this._currentAxis = initialColorSpaceView.currentAxis;

    // Initialize color space buttons
    this._setupColorSpaceButtons(this._colorSpace);

    // Initialize axis buttons for the current color space
    this._updateAxisButtons();

    // Set up slider
    this._axisSlider.addEventListener('input', (event) => {
      const value = parseInt(event.target.value);
      const colorSpaceView = new ColorSpaceView(this._colorSpace, this._currentAxis, value, this._boundariesToggle.checked);
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
   * @param {ColorSpace} colorSpace - The currently selected color space
   */
  _setupColorSpaceButtons(colorSpace) {
    const colorSpaceSelector = document.querySelector('.color-space-selector');
    clearElement(colorSpaceSelector);

    getAllColorSpaces().forEach((cs) => {
      const label = createElement('label');
      label.className = 'radio-button';

      const radio = createElement('input');
      radio.type = 'radio';
      radio.name = 'color-space';
      radio.value = cs.getType();

      // Make the selected color space checked
      if (cs === colorSpace) {
        radio.checked = true;
      }

      const span = createElement('span', cs.getType());

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
    this._colorSpace = getColorSpaceByType(colorSpaceType);

    // Update axis buttons for the new color space
    this._updateAxisButtons();

    // Reset to default axis
    const defaultAxis = this._colorSpace.getDefaultAxis();
    this._currentAxis = defaultAxis;

    // Create new color space view with default axis
    const colorSpaceView = new ColorSpaceView(
      this._colorSpace,
      defaultAxis,
      defaultAxis.defaultValue,
      this._boundariesToggle.checked
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
    const colorSpaceView = new ColorSpaceView(this._colorSpace, axis, axis.defaultValue, this._boundariesToggle.checked);

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
   * Trigger an update to re-render with current settings
   */
  _triggerUpdate() {
    const currentColorSpaceView = new ColorSpaceView(
      this._colorSpace,
      this._currentAxis,
      parseInt(this._axisSlider.value),
      this._boundariesToggle.checked
    );
    this._onColorSpaceChange(currentColorSpaceView);
  }
}
