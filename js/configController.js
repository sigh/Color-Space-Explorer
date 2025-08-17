import { clearElement, createElement } from './utils.js';
import { getAllColorSpaces, getAllDistanceMetrics, getDistanceMetricById, getDefaultDistanceMetric, Axis } from './colorSpace.js';
import { RangeSlider } from './rangeSlider.js';

/**
 * Immutable color space configuration - a simple container for current axis and value
 */
export class ColorSpaceConfig {
  constructor(
    colorSpace,
    axisSlices,
    render3d = false,
    usePolarCoordinates = false,
    showBoundaries = true,
    distanceMetric = null,
    distanceThreshold = null,
    highlightMode = null,
    showUnmatchedColors = true) {

    this.colorSpace = colorSpace;
    this.axisSlices = axisSlices;
    this.render3d = render3d;
    this.usePolarCoordinates = !render3d && usePolarCoordinates && colorSpace.availablePolarAxis(this.currentAxis);

    this.showBoundaries = showBoundaries;
    this.distanceMetric = distanceMetric || getDefaultDistanceMetric();
    this.distanceThreshold = distanceThreshold ?? this.distanceMetric.defaultThreshold;
    this.highlightMode = highlightMode || getAllHighlightModes()[0];
    this.showUnmatchedColors = showUnmatchedColors;

    // Freeze the object to make it immutable
    Object.freeze(this);
  }

  // Backward compatibility getters for 2D renderer
  get currentAxis() {
    for (const key of this.axisSlices.keys()) {
      return key;
    }
  }

  get currentValue() {
    for (const values of this.axisSlices.values()) {
      return values[0];
    }
  }
}

/**
 * Get all available highlight modes
 * @returns {string[]} Array of highlight mode strings
 */
export function getAllHighlightModes() {
  return ['dim-other', 'hide-other', 'boundary'];
}

/**
 * Configuration controller for handling axis controls and boundaries toggle
 */
export class ConfigController {
  constructor(container, initialColorSpaceConfig, onColorSpaceChange) {
    // Axis control elements
    this._axisLabel2d = container.querySelector('.axis-label');
    this._axisSelector = container.querySelector('.axis-selector');
    this._2dOnlyControls = container.querySelectorAll('.only-2d');
    this._3dOnlyControls = container.querySelectorAll('.only-3d');

    this._render3d = initialColorSpaceConfig.render3d;

    // Boundaries toggle element
    this._boundariesToggle = container.querySelector('.boundaries-toggle');

    // Hide unmatched colors toggle element
    this._showUnmatchedToggle = container.querySelector('.show-unmatched-toggle');

    // Polar coordinates toggle element
    this._polarToggle = container.querySelector('.polar-toggle');

    // Distance metric dropdown element
    this._distanceMetricDropdown = container.querySelector('.distance-metric-dropdown');

    // Highlight mode dropdown element
    this._highlightModeDropdown = container.querySelector('.highlight-mode-dropdown');

    // Callback
    this._onColorViewUpdate = onColorSpaceChange;

    // Initialize the UI with the provided color space configuration
    this._boundariesToggle.addEventListener('change', () => {
      this._onColorViewUpdate();
    });

    this._showUnmatchedToggle.addEventListener('change', () => {
      this._onColorViewUpdate();
    });

    this._polarToggle.addEventListener('change', () => {
      this._onColorViewUpdate();
    });

    // Render mode toggle elements
    const renderModeRadios = container.querySelectorAll('input[name="render-mode"]');
    renderModeRadios.forEach(radio => {
      radio.addEventListener('change', (event) => {
        this._render3d = (event.target.value === '3d');
        this._updateDimControlsVisibility();
        this._onColorViewUpdate();
      });
      radio.checked =
        ((radio.value === '3d') === initialColorSpaceConfig.render3d);
    });

    this._setupColorSpaceControls(container, initialColorSpaceConfig);
    this._setupDistanceMetricsDropdown(initialColorSpaceConfig.distanceMetric);
    this._setupDistanceThresholdSlider(container, initialColorSpaceConfig);
    this._setupHighlightModeDropdown(initialColorSpaceConfig.highlightMode);

    // Set the current state from the config
    if (!this._render3d) {
      this._polarToggle.checked = initialColorSpaceConfig.usePolarCoordinates;
    }
    this._boundariesToggle.checked = initialColorSpaceConfig.showBoundaries;
    this._showUnmatchedToggle.checked = initialColorSpaceConfig.showUnmatchedColors;

    // Update visibility of 2D controls
    this._updateDimControlsVisibility();
  }

  /**
   * Update visibility of 2D-only and 3D-only controls based on render mode
   */
  _updateDimControlsVisibility() {
    this._2dOnlyControls.forEach(control => {
      control.style.display = this._render3d ? 'none' : 'block';
    });
    this._3dOnlyControls.forEach(control => {
      control.style.display = this._render3d ? 'block' : 'none';
    });
  }

  /**
   * Initialize color space controls
   * @param {ColorSpace} initialColorSpaceConfig - Initial color space
   * @param {HTMLElement} container - Container element for controls
   */
  _setupColorSpaceControls(container, initialColorSpaceConfig) {
    const axisSlider2d = container.querySelector('.axis-slider-2d');

    this._axisSlider2d = this._makeLabeledSlider(
      axisSlider2d,
      (value) => `${value}${this._currentAxis.unit}`);


    const axisSliderContainer3d = container.querySelector('.axis-sliders-3d');
    this._axisSliders3d = [];
    this._axisLabels3d = [];
    for (let i = 0; i < 3; i++) {
      const labelContainer = createElement('div');
      labelContainer.className = 'control-label';
      const label = createElement('span', 'hello');
      labelContainer.appendChild(label);
      this._axisLabels3d.push(label);
      axisSliderContainer3d.appendChild(labelContainer);

      const sliderDiv = createElement('div');
      const slider = this._makeLabeledSlider(
        sliderDiv,
        (value) => {
          const axis = this._colorSpace.getAllAxes()[i];
          return `${value}${axis.unit}`;
        },
        2);
      this._axisSliders3d.push(slider);
      axisSliderContainer3d.appendChild(sliderDiv);
    }

    this._setupColorSpaceButtons(container, initialColorSpaceConfig.colorSpace);
    this._selectColorSpace(
      initialColorSpaceConfig.colorSpace, initialColorSpaceConfig.currentAxis);

    if (!this._render3d) {
      this._axisSlider2d.setValue(initialColorSpaceConfig.currentValue);
    } else {
      for (const [axis, range] of initialColorSpaceConfig.axisSlices.entries()) {
        const axisIndex = this._colorSpace.getAxisIndex(axis);
        this._axisSliders3d[axisIndex].setValues(range);
      }
    }
  }

  /**
   * Create a labeled slider
   * @param {HTMLElement} container
   * @param {function} toString - Function to convert slider value to string
   * @param {number} [numThumbs=1] - Number of thumbs for the slider
   * @returns
   */
  _makeLabeledSlider(container, toString, numThumbs = 1) {
    container.classList.add('slider-container');

    const axisValue = document.createElement('span');
    axisValue.className = 'slider-display-value';
    const axisRangeSlider = new RangeSlider(
      container,
      {
        numThumbs,
        onChange: (...values) => {
          axisValue.textContent = values.map(toString).join('-');
          this._onColorViewUpdate();
        }
      });
    container.appendChild(axisValue);
    return axisRangeSlider;
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
        this._selectColorSpace(cs, cs.getDefaultAxis());
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

    this._distanceMetricDropdown.addEventListener('change', () => {
      this._distanceThresholdSlider.setValue(
        this._distanceThresholdSlider.getValue());
      this._onColorViewUpdate();
    });

    this._distanceMetricDropdown.value = initialMetric.id;
  }

  /**
   * Set distance threshold slider from a ColorSpaceConfig
   * @param {HTMLElement} container - The container element for the slider
   * @param {ColorSpaceConfig} config - The color space configuration containing threshold
   */
  _setupDistanceThresholdSlider(container, config) {
    this._distanceThresholdSlider = this._makeLabeledSlider(
      container.querySelector('.distance-threshold-slider'),
      (value) => {
        const metric = getDistanceMetricById(this._distanceMetricDropdown.value);
        const threshold = fromLogThreshold(metric, value);
        return metric.thresholdToString(threshold);
      }
    );

    this._distanceThresholdSlider.setRange(0, 100);

    const logValue = toLogThreshold(config.distanceMetric, config.distanceThreshold);

    this._distanceThresholdSlider.setValue(logValue);
  }

  /**
   * Setup the highlight mode dropdown
   * @param {string} initialHighlightMode - The initial highlight mode to select
   */
  _setupHighlightModeDropdown(initialHighlightMode) {
    this._highlightModeDropdown.addEventListener('change', () => {
      this._onColorViewUpdate();
    });

    this._highlightModeDropdown.value = initialHighlightMode;
  }

  /**
   * Update the axis buttons based on the current color space
   * @param {ColorSpace} colorSpace - The currently selected color space
   * @param {Axis} initialAxis - The default axis for the color space
   */
  _update2dAxisButtons(colorSpace, initialAxis) {
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
   * @param {Axis} axis - Axis for the color space
   */
  _selectColorSpace(colorSpace, axis) {
    // Update color space
    this._colorSpace = colorSpace;

    axis ||= colorSpace.getDefaultAxis();

    // Update axis buttons for the new color space
    this._update2dAxisButtons(colorSpace, axis);

    // Update 3d axis sliders and labels
    const allAxes = colorSpace.getAllAxes();
    for (let i = 0; i < allAxes.length; i++) {
      const axis = allAxes[i];
      this._axisLabels3d[i].textContent = axis.name;
      this._axisSliders3d[i].setRange(axis.min, axis.max);
      this._axisSliders3d[i].setValues([axis.min, axis.max]);
    }
  }

  /**
   * Select a specific axis
   * @param {Axis} axis - Axis to select
   */
  _selectAxis(axis) {
    this._currentAxis = axis;

    this._axisSlider2d.setRange(axis.min, axis.max);
    this._axisSlider2d.setValue(axis.defaultValue);
    this._axisLabel2d.textContent = axis.name;

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
   * Get the current color space configuration based on current UI state
   * @returns {ColorSpaceConfig} Current color space configuration
   */
  getCurrentColorSpaceConfig() {
    const metric = getDistanceMetricById(this._distanceMetricDropdown.value);
    const threshold = fromLogThreshold(metric, this._distanceThresholdSlider.getValue());

    const axisSlices = new Map();
    if (this._render3d) {
      const allAxes = this._colorSpace.getAllAxes();
      for (let i = 0; i < allAxes.length; i++) {
        axisSlices.set(allAxes[i], this._axisSliders3d[i].getValues());
      }
    } else {
      const value = this._axisSlider2d.getValue();
      axisSlices.set(this._currentAxis, [value, value]);
    }

    const usePolarCoordinates = this._polarToggle.checked;

    return new ColorSpaceConfig(
      this._colorSpace,
      axisSlices,
      this._render3d,
      usePolarCoordinates,
      this._boundariesToggle.checked,
      metric,
      threshold,
      this._highlightModeDropdown.value,
      this._showUnmatchedToggle.checked
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
