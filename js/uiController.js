import { clearElement, createElement } from './utils.js';
import { ColorSpaceView, getAllColorSpaces } from './colorSpace.js';

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
    this._onColorViewUpdate = onColorSpaceChange;

    // Initialize the UI with the provided color space view
    this._boundariesToggle.addEventListener('change', () => {
      this._onColorViewUpdate();
    });
    this._setupColorSpaceControls(initialColorSpaceView.colorSpace);

    // Set the current state from the view
    this._selectAxis(initialColorSpaceView.currentAxis);
    this._axisSlider.value = initialColorSpaceView.currentValue;
    this._updateSliderLabel(initialColorSpaceView);
    this._boundariesToggle.checked = initialColorSpaceView.showBoundaries;
  }

  /**
   * Initialize color space controls
   * @param {ColorSpace} initialColorSpace - Initial color space
   */
  _setupColorSpaceControls(initialColorSpace) {
    // Set up slider event listener
    this._axisSlider.addEventListener('input', () => {
      const colorSpaceView = this.getCurrentColorSpaceView();
      this._updateSliderLabel(colorSpaceView);
      this._onColorViewUpdate();
    });

    this._setupColorSpaceButtons(initialColorSpace);
    this._selectColorSpace(initialColorSpace);
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
        this._selectColorSpace(cs);
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
        this._selectAxis(axis);
      });
    });
  }

  /**
   * Select a new color space type
   * @param {ColorSpace} colorSpace - Color space to select
   */
  _selectColorSpace(colorSpace) {
    // Update color space
    this._colorSpace = colorSpace;

    // Update axis buttons for the new color space
    this._updateAxisButtons();

    // Reset to default axis
    const defaultAxis = this._colorSpace.getDefaultAxis();
    this._selectAxis(defaultAxis);
  }

  /**
   * Select a specific axis
   * @param {Axis} axis - Axis to select
   */
  _selectAxis(axis) {
    this._currentAxis = axis;

    // Set up slider.
    this._axisSlider.min = axis.min;
    this._axisSlider.max = axis.max;
    this._axisSlider.value = axis.defaultValue;

    const colorSpaceView = this.getCurrentColorSpaceView();

    // Update display
    this._updateSliderLabel(colorSpaceView);

    // Notify change
    this._onColorViewUpdate();
  }

  /**
   * Update slider labels
   * @param {ColorSpaceView} colorSpaceView - Color space view to display
   */
  _updateSliderLabel(colorSpaceView) {
    const axis = colorSpaceView.currentAxis;

    // Update labels
    this._axisLabel.textContent = axis.name;
    this._axisValue.textContent = `${colorSpaceView.currentValue}${axis.unit}`;
  }

  /**
   * Get the current color space view based on current UI state
   * @returns {ColorSpaceView} Current color space view
   */
  getCurrentColorSpaceView() {
    return new ColorSpaceView(
      this._colorSpace,
      this._currentAxis,
      parseInt(this._axisSlider.value),
      this._boundariesToggle.checked
    );
  }
}
