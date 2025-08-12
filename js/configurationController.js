import { clearElement, createElement } from './utils.js';
import { getAllColorSpaces, getAllDistanceMetrics, getDistanceMetricById, getDefaultDistanceMetric } from './colorSpace.js';

/**
 * Immutable color space configuration - a simple container for current axis and value
 */
export class ColorSpaceConfig {
  constructor(colorSpace, render3d = false, config2d = null, showBoundaries = true, distanceMetric = null, distanceThreshold = null) {
    this.colorSpace = colorSpace;
    this.render3d = render3d;
    this.config2d = null;
    if (!this.render3d) {
      this.config2d = {
        currentAxis: colorSpace.getDefaultAxis(),
        currentValue: colorSpace.getDefaultAxis().defaultValue,
        usePolarCoordinates: false
      };
      Object.assign(this.config2d, config2d || {});
    }

    this.showBoundaries = showBoundaries;
    this.distanceMetric = distanceMetric || getDefaultDistanceMetric();
    this.distanceThreshold = distanceThreshold ?? this.distanceMetric.maxThreshold;

    // Freeze the object to make it immutable
    Object.freeze(this.config2d);
    Object.freeze(this);
  }

  // Backward compatibility getters for 2D renderer
  get currentAxis() {
    return this.config2d?.currentAxis || this.colorSpace.getDefaultAxis();
  }

  get currentValue() {
    return this.config2d?.currentValue;
  }

  get usePolarCoordinates() {
    return this.config2d?.usePolarCoordinates || false;
  }
}

/**
 * Configuration controller for handling axis controls and boundaries toggle
 */
export class ConfigurationController {
  constructor(container, initialColorSpaceConfig, onColorSpaceChange) {
    // Axis control elements
    this._axisSlider = container.querySelector('.axis-slider');
    this._axisValue = container.querySelector('.axis-slider-value');
    this._axisLabel = container.querySelector('.axis-label');
    this._axisSelector = container.querySelector('.axis-selector');
    this._2dOnlyControls = container.querySelectorAll('.only-2d');

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

    // Initialize the UI with the provided color space configuration
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

    // Render mode toggle elements
    const renderModeRadios = container.querySelectorAll('input[name="render-mode"]');
    renderModeRadios.forEach(radio => {
      radio.addEventListener('change', (event) => {
        this._render3d = (event.target.value === '3d');
        this._update2DControlsVisibility();
        this._onColorViewUpdate();
      });
      radio.checked =
        ((radio.value === '3d') === initialColorSpaceConfig.render3d);
    });

    this._setupColorSpaceControls(container, initialColorSpaceConfig);
    this._setupDistanceMetricsDropdown(initialColorSpaceConfig.distanceMetric);
    this._setupDistanceThresholdSlider(initialColorSpaceConfig);

    // Set the current state from the config
    this._render3d = initialColorSpaceConfig.render3d;
    if (!this._render3d) {
      this._axisSlider.value = initialColorSpaceConfig.config2d.currentValue;
      this._updateSliderLabel(
        initialColorSpaceConfig.config2d.currentAxis, initialColorSpaceConfig.config2d.currentValue);
      this._polarToggle.checked = initialColorSpaceConfig.config2d.usePolarCoordinates;
    }
    this._boundariesToggle.checked = initialColorSpaceConfig.showBoundaries;

    // Update visibility of 2D controls
    this._update2DControlsVisibility();
  }

  /**
   * Update visibility of 2D-only controls based on render mode
   */
  _update2DControlsVisibility() {
    this._2dOnlyControls.forEach(control => {
      control.style.display = this._render3d ? 'none' : 'block';
    });
  }

  /**
   * Initialize color space controls
   * @param {ColorSpace} initialColorSpaceConfig - Initial color space
   * @param {HTMLElement} container - Container element for controls
   */
  _setupColorSpaceControls(container, initialColorSpaceConfig) {
    // Set up slider event listener
    this._axisSlider.addEventListener('input', (event) => {
      this._updateSliderLabel(this._currentAxis, event.target.value);
      this._onColorViewUpdate();
    });

    this._setupColorSpaceButtons(container, initialColorSpaceConfig.colorSpace);
    this._selectColorSpace(
      initialColorSpaceConfig.colorSpace, initialColorSpaceConfig.config2d?.currentAxis);
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
   * Set distance threshold slider from a ColorSpaceConfig
   * @param {ColorSpaceConfig} config - The color space configuration containing threshold
   */
  _setupDistanceThresholdSlider(config) {
    this._distanceThresholdSlider.min = 0;
    this._distanceThresholdSlider.max = 100;
    this._distanceThresholdSlider.step = 1;

    const logValue = toLogThreshold(config.distanceMetric, config.distanceThreshold);

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
   * Get the current color space configuration based on current UI state
   * @returns {ColorSpaceConfig} Current color space configuration
   */
  getCurrentColorSpaceConfig() {
    const metric = getDistanceMetricById(this._distanceMetricDropdown.value);
    const threshold = fromLogThreshold(metric, this._distanceThresholdSlider.value);

    // Only collect 2D config if in 2D mode
    const config2d = this._render3d ? null : {
      currentAxis: this._currentAxis,
      currentValue: parseInt(this._axisSlider.value),
      usePolarCoordinates: this._polarToggle.checked && this._colorSpace.availablePolarAxis(this._currentAxis)
    };

    return new ColorSpaceConfig(
      this._colorSpace,
      this._render3d,
      config2d,
      this._boundariesToggle.checked,
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
