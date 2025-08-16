import { CanvasRenderer } from './canvasRenderer.js';
import { CanvasUI } from './canvasUI.js';
import { ConfigController, ColorSpaceConfig, getAllHighlightModes } from './configController.js';
import { getAllColorSpaces, getAllDistanceMetrics, getColorSpaceByType, getDefaultDistanceMetric, getDistanceMetricById } from './colorSpace.js';
import { ColorPalette } from './colorPalette.js';
import { ColorDisplay } from './colorDisplay.js';
import { deferUntilAnimationFrame } from './utils.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this._deferredUpdateRenderer = deferUntilAnimationFrame(
      this._updateRenderer.bind(this));

    // Initialize 3D mode state from URL
    this._render3d = new URLSearchParams(window.location.search).has('3d');

    const colorDisplayContainer = document.querySelector('.color-display-section');
    this._colorDisplay = new ColorDisplay(colorDisplayContainer);

    const paletteContainer = document.querySelector('.palette-section');
    const addButton = document.querySelector('.add-color-btn');
    this._colorPalette = new ColorPalette(
      paletteContainer,
      addButton,
      this._colorDisplay,
      // Don't defer palette updates, as they have arguments which shouldn't
      // get overridden by later calls.
      this._updateRenderer.bind(this));

    // Try to load state from URL, otherwise use defaults
    const initialColorSpaceConfig = URLStateManager.deserializeColorSpaceConfigFromURL();

    // Initialize 3D mode state from the config
    this._render3d = initialColorSpaceConfig.render3d;

    this._configController = new ConfigController(
      document.querySelector('.control-panel'),
      initialColorSpaceConfig,
      this._deferredUpdateRenderer.bind(this));
  }

  async init() {
    this._renderer = await CanvasRenderer.create(
      document.querySelector('.canvas-container'));

    // Create canvas UI handler
    this._canvasUI = new CanvasUI(
      document.querySelector('.canvas-panel'),
      this._renderer,
      this._colorDisplay,
      this._colorPalette,
      URLStateManager,
      this._deferredUpdateRenderer);
    this._canvasUI.setRender3d3d(this._render3d);

    this._updateRenderer(); // No deferral
  }

  _updateRenderer() {
    if (!this._renderer) return;
    const colorSpaceConfig = this._configController.getCurrentColorSpaceConfig();
    const paletteColors = this._colorPalette.getColors();
    const highlightColor = this._colorPalette.getHighlightColor();

    // Update 3D state from config
    if (this._render3d !== colorSpaceConfig.render3d) {
      this._render3d = colorSpaceConfig.render3d;
      this._canvasUI.setRender3d3d(this._render3d);
    }

    // Pass rotation matrix for 3D renderer
    if (this._render3d) {
      this._renderer.render3DColorSpace(
        colorSpaceConfig,
        paletteColors,
        highlightColor,
        this._canvasUI.getRotationMatrix()
      );
    } else {
      this._renderer.renderColorSpace(
        colorSpaceConfig,
        paletteColors,
        highlightColor
      );
    }

    // Serialize state to URL whenever we render
    URLStateManager.serializeColorSpaceConfigToURL(colorSpaceConfig);

    this._canvasUI.recalculateSelection();
  }
}

/**
 * URL serialization utilities
 */
class URLStateManager {
  /**
   * Serialize ColorSpaceConfig to URL parameters
   * @param {ColorSpaceConfig} colorSpaceConfig - The configuration to serialize
   */
  static serializeColorSpaceConfigToURL(colorSpaceConfig) {
    const params = new URLSearchParams();
    params.set('space', colorSpaceConfig.colorSpace.getType());

    if (colorSpaceConfig.render3d) {
      for (const [axis, range] of colorSpaceConfig.axisSlices) {
        // 3D: Only include if not the full range
        if (range[0] !== axis.min || range[1] !== axis.max) {
          params.set(axis.key, `${range[0]}-${range[1]}`);
        }
      }
    } else {
      for (const [axis, range] of colorSpaceConfig.axisSlices) {
        // 2D: Take the first range value and stop.
        params.set(axis.key, `${range[0]}`);
        break;
      }
    }

    const distanceMetric = colorSpaceConfig.distanceMetric;
    params.set(
      distanceMetric.id,
      distanceMetric.thresholdToString(colorSpaceConfig.distanceThreshold));

    const regionsParam = colorSpaceConfig.showBoundaries ? '' : '&noregions';
    const polarParam = (!colorSpaceConfig.render3d && colorSpaceConfig.usePolarCoordinates) ? '&polar' : '';

    // Include 3D parameter if enabled
    const current3dParam = colorSpaceConfig.render3d ? '&3d' : '';

    // Include highlight mode parameter if not default
    const defaultHighlightMode = getAllHighlightModes()[0];
    const highlightParam = (colorSpaceConfig.highlightMode !== defaultHighlightMode) ? `&h=${colorSpaceConfig.highlightMode}` : '';

    const fragment = window.location.hash;
    const newURL = `${window.location.pathname}?${params.toString()}${regionsParam}${polarParam}${current3dParam}${highlightParam}${fragment}`;

    window.history.replaceState(null, '', newURL);
  }

  /**
   * Serialize selected color coordinates to URL fragment
   * @param {Array<number>|null} coordinates - Canvas coordinates as [x, y]
   */
  static serializeSelectionToFragment(coordinates) {
    if (!coordinates) {
      // Clear fragment if no color selected
      const newURL = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', newURL);
      return;
    }

    coordinates = coordinates.map(coord => Math.round(coord));
    const fragment = `#${coordinates.join(',')}`;
    const newURL = `${window.location.pathname}${window.location.search}${fragment}`;
    window.history.replaceState(null, '', newURL);
  }

  /**
   * Deserialize selection coordinates from URL fragment
   * @returns {Array<number>|null} Canvas coordinates as [x, y] or null if no selection
   */
  static deserializeSelectionFromFragment() {
    const fragment = window.location.hash;
    if (!fragment || fragment.length <= 1) {
      return null;
    }

    // Remove the # and split by comma
    const coords = fragment.slice(1).split(',').map(s => parseInt(s, 10));
    if (coords.length !== 2 || !coords.every(Number.isInteger)) {
      return null;
    }

    return coords;
  }

  /**
   * Deserialize ColorSpaceConfig from URL parameters
   * @returns {ColorSpaceConfig} ColorSpaceConfig instance, or a default configuration if parameters are invalid
   */
  static deserializeColorSpaceConfigFromURL() {
    const params = new URLSearchParams(window.location.search);

    // Lookup the color space, or default to the first available.
    const spaceParam = params.get('space')?.toUpperCase();
    const colorSpace = getColorSpaceByType(spaceParam) || getAllColorSpaces()[0];

    const axisSlices = new Map();
    for (const axis of colorSpace.getAllAxes()) {
      const axisValue = params.get(axis.key);
      if (axisValue === null) continue;

      // Check if it's a range (contains dash) or single value
      if (axisValue.includes('-')) {
        const [min, max] = axisValue.split('-').map(Number);
        if (axis.isValidValue(min) && axis.isValidValue(max)) {
          axisSlices.set(axis, [min, max]);
        }
      } else {
        // Single value
        const value = Number(axisValue);
        if (axis.isValidValue(value)) {
          axisSlices.set(axis, [value, value]);
        }
      }
    }

    const render3d = params.has('3d');

    if (!render3d && axisSlices.size === 0) {
      // Set defaults to use if we can't find valid parameters
      const axis = colorSpace.getDefaultAxis();
      axisSlices.set(axis, [axis.defaultValue, axis.defaultValue]);
    }

    const showBoundaries = !params.has('noregions');
    const usePolarCoordinates = params.has('polar');

    // Get highlight mode from URL, default to first available mode
    const highlightModeParam = params.get('h');
    const availableHighlightModes = getAllHighlightModes();
    const highlightMode = availableHighlightModes.includes(highlightModeParam)
      ? highlightModeParam
      : availableHighlightModes[0];

    // Look for distance metric and threshold in URL parameters
    let distanceMetric = getDefaultDistanceMetric();
    let threshold = distanceMetric.defaultThreshold;

    // Check each available distance metric to see if it's in the URL
    for (const metric of getAllDistanceMetrics()) {
      const thresholdValue = params.get(metric.id);
      if (thresholdValue !== null) {
        distanceMetric = metric;
        const parsedThreshold = parseFloat(thresholdValue);
        threshold = !isNaN(parsedThreshold) ? parsedThreshold : metric.maxThreshold;
        break;
      }
    }

    return new ColorSpaceConfig(colorSpace, axisSlices, render3d, usePolarCoordinates, showBoundaries, distanceMetric, threshold, highlightMode);
  }
}


// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ColorSpaceExplorer();
  await app.init();
});
