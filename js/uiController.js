import { clearElement, createElement } from './utils.js';
import { ColorSpaceView, getAllColorSpaces, getAllDistanceMetrics, getDistanceMetricById } from './colorSpace.js';

/**
 * UI controller for handling axis controls and boundaries toggle
 */
export class UIController {
  constructor(container, initialColorSpaceView, onColorSpaceChange) {
    // Axis control elements
    this._axisSlider = container.querySelector('.axis-slider');
    this._axisValue = container.querySelector('.axis-slider-value');
    this._axisLabel = container.querySelector('.axis-label');
    this._axisSelector = container.querySelector('.axis-selector');

    // Boundaries toggle element
    this._boundariesToggle = container.querySelector('.boundaries-toggle');

    // Polar coordinates toggle element
    this._polarToggle = container.querySelector('.polar-toggle');

    // Distance metric dropdown element
    this._distanceMetricDropdown = container.querySelector('.distance-metric-dropdown');

    // Distance threshold slider elements
    this._distanceThresholdSlider = container.querySelector('.distance-threshold-slider');
    this._distanceThresholdLabel = container.querySelector('.distance-threshold-value');

    // Callback
    this._onColorViewUpdate = onColorSpaceChange;

    // Initialize the UI with the provided color space view
    this._boundariesToggle.addEventListener('change', () => {
      this._onColorViewUpdate();
    });

    this._polarToggle.addEventListener('change', () => {
      this._onColorViewUpdate();
    });

    this._distanceMetricDropdown.addEventListener('change', () => {
      this._updateDistanceThresholdLabel();
      this._onColorViewUpdate();
    });

    this._distanceThresholdSlider.addEventListener('input', () => {
      this._updateDistanceThresholdLabel();
      this._onColorViewUpdate();
    });

    this._setupColorSpaceControls(container, initialColorSpaceView);
    this._setupDistanceMetricsDropdown(initialColorSpaceView.distanceMetric);
    this._setupDistanceThresholdSlider(initialColorSpaceView);

    // Set the current state from the view
    this._axisSlider.value = initialColorSpaceView.currentValue;
    this._updateSliderLabel(
      initialColorSpaceView.currentAxis, initialColorSpaceView.currentValue);
    this._boundariesToggle.checked = initialColorSpaceView.showBoundaries;
    this._polarToggle.checked = initialColorSpaceView.usePolarCoordinates;
  }

  /**
   * Initialize color space controls
   * @param {ColorSpace} initialColorSpaceView - Initial color space
   * @param {HTMLElement} container - Container element for controls
   */
  _setupColorSpaceControls(container, initialColorSpaceView) {
    // Set up slider event listener
    this._axisSlider.addEventListener('input', (event) => {
      this._updateSliderLabel(this._currentAxis, event.target.value);
      this._onColorViewUpdate();
    });

    this._setupColorSpaceButtons(container, initialColorSpaceView.colorSpace);
    this._selectColorSpace(
      initialColorSpaceView.colorSpace, initialColorSpaceView.currentAxis);
  }

  /**
   * Update the color space buttons based on available color spaces
   * @param {ColorSpace} colorSpace - The currently selected color space
   * @param {HTMLElement} container - Container element for controls
   */
  _setupColorSpaceButtons(container, colorSpace) {
    const colorSpaceSelector = container.querySelector('.color-space-selector');
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
   * Setup the distance metrics dropdown with configured options
   * @param {DistanceMetric} initialMetric - The initial distance metric to select
   */
  _setupDistanceMetricsDropdown(initialMetric) {
    // Clear existing options
    clearElement(this._distanceMetricDropdown);

    // Add options from configuration
    getAllDistanceMetrics().forEach(metric => {
      const option = createElement('option');
      option.value = metric.id;
      option.textContent = metric.displayName;

      this._distanceMetricDropdown.appendChild(option);
    });

    this._distanceMetricDropdown.value = initialMetric.id;
  }

  /**
   * Set distance threshold slider from a ColorSpaceView
   * @param {ColorSpaceView} view - The color space view containing threshold
   */
  _setupDistanceThresholdSlider(view) {
    this._distanceThresholdSlider.min = 0;
    this._distanceThresholdSlider.max = 100;
    this._distanceThresholdSlider.step = 1;

    const logValue = toLogThreshold(view.distanceMetric, view.distanceThreshold);

    this._distanceThresholdSlider.value = logValue;

    this._updateDistanceThresholdLabel();
  }

  /**
   * Update the distance threshold label based on current slider value
   */
  _updateDistanceThresholdLabel() {
    const metric = getDistanceMetricById(this._distanceMetricDropdown.value);
    const threshold = fromLogThreshold(metric, this._distanceThresholdSlider.value);

    this._distanceThresholdLabel.textContent = metric.thresholdToString(threshold);
  }

  /**
   * Update the axis buttons based on the current color space
   * @param {ColorSpace} colorSpace - The currently selected color space
   * @param {Axis} initialAxis - The default axis for the color space
   */
  _updateAxisButtons(colorSpace, initialAxis) {
    clearElement(this._axisSelector); // Clear existing buttons

    const axes = colorSpace.getAllAxes();

    axes.forEach((axis) => {
      const label = createElement('label');
      label.className = 'radio-button';

      const radio = createElement('input');
      radio.type = 'radio';
      radio.name = 'axis';
      radio.value = axis.key;

      // Make the default axis checked by default
      if (axis === initialAxis) {
        radio.checked = true;
      }

      const span = createElement('span', axis.name);

      label.appendChild(radio);
      label.appendChild(span);
      this._axisSelector.appendChild(label);

      // Attach event listener directly
      radio.addEventListener('change', () => {
        this._selectAxis(axis);
      });
    });

    this._selectAxis(initialAxis);
  }

  /**
   * Select a new color space type
   * @param {ColorSpace} colorSpace - Color space to select
   * @param {Axis} [axis] - Optional axis to select, defaults to the color space's default axis
   */
  _selectColorSpace(colorSpace, axis) {
    // Update color space
    this._colorSpace = colorSpace;

    axis ||= colorSpace.getDefaultAxis();

    // Update axis buttons for the new color space
    this._updateAxisButtons(colorSpace, axis);
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

    this._updateSliderLabel(axis, axis.defaultValue);

    // Update polar toggle visibility
    this._updatePolarToggleVisibility();

    // Notify change
    this._onColorViewUpdate();
  }

  /**
   * Update the visibility of the polar coordinates toggle
   */
  _updatePolarToggleVisibility() {
    const polarAxis = this._colorSpace.availablePolarAxis(this._currentAxis);
    this._polarToggle.parentNode.style.visibility = polarAxis ? 'visible' : 'hidden';
  }

  /**
   * Update slider labels
   * @param {Axis} axis - The axis being updated
   * @param {number} value - The current value of the axis
   */
  _updateSliderLabel(axis, value) {
    this._axisLabel.textContent = axis.name;
    this._axisValue.textContent = `${value}${axis.unit}`;
  }

  /**
   * Get the current color space view based on current UI state
   * @returns {ColorSpaceView} Current color space view
   */
  getCurrentColorSpaceView() {
    const metric = getDistanceMetricById(this._distanceMetricDropdown.value);
    const threshold = fromLogThreshold(metric, this._distanceThresholdSlider.value);

    return new ColorSpaceView(
      this._colorSpace,
      this._currentAxis,
      parseInt(this._axisSlider.value),
      this._boundariesToggle.checked,
      this._polarToggle.checked && this._colorSpace.availablePolarAxis(this._currentAxis),
      metric,
      threshold
    );
  }
}


/**
 * Convert a threshold value to a logarithmic scale
 * @param {DistanceMetric} metric - The distance metric
 * @param {number} threshold - The threshold value
 * @returns {number} The logarithmic scale value
 */
function toLogThreshold(metric, threshold) {
  const logThreshold = Math.log(Math.max(metric.minThreshold, Math.min(metric.maxThreshold, threshold)));
  const logValue = ((logThreshold - metric.logMinThreshold) / metric.logRange) * 100;
  return logValue;
}

/**
 * Convert linear slider value (0-100) to logarithmic threshold value
 * @param {DistanceMetric} metric - The distance metric
 * @param {number} value - The linear slider value
 * @returns {number} The logarithmic threshold value
 */
function fromLogThreshold(metric, value) {
  const logValue = metric.logMinThreshold + (value / 100) * metric.logRange;
  const threshold = Math.exp(logValue);
  return threshold;
}