import { CanvasRenderer } from './canvasRenderer.js';
import { CanvasUI } from './canvasUI.js';
import { UIController } from './uiController.js';
import { getAllColorSpaces, getAllDistanceMetrics, ColorSpaceView, getColorSpaceByType, getDefaultDistanceMetric, getDistanceMetricById } from './colorSpace.js';
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
    this._use3D = new URLSearchParams(window.location.search).has('3d');

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
    const initialColorSpaceView = URLStateManager.deserializeColorSpaceViewFromURL();

    this._uiController = new UIController(
      document.querySelector('.control-panel'),
      initialColorSpaceView,
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
    this._canvasUI.setUse3D(this._use3D);

    this._updateRenderer(); // No deferral
  }

  _updateRenderer(options) {
    if (!this._renderer) return;
    const colorSpaceView = this._uiController.getCurrentColorSpaceView();
    const paletteColors = this._colorPalette.getColors();

    // Pass rotation matrix for 3D renderer
    if (this._use3D) {
      this._renderer.render3DColorSpace(
        colorSpaceView,
        paletteColors,
        options?.highlightIndex,
        this._canvasUI.getRotationMatrix()
      );
    } else {
      this._renderer.renderColorSpace(
        colorSpaceView,
        paletteColors,
        options?.highlightIndex
      );
    }

    // Serialize state to URL whenever we render
    URLStateManager.serializeColorSpaceViewToURL(colorSpaceView);

    this._canvasUI.recalculateSelection();
  }

  /**
   * Toggle between 3D and 2D rendering modes
   * @param {boolean} use3D - Whether to use 3D mode
   */
  async toggle3DMode(use3D) {
    if (this._use3D === use3D) return; // No change needed

    this._use3D = use3D;

    // Update canvas UI for new mode
    this._canvasUI.setUse3D(this._use3D);

    this._updateRenderer();
  }
}

/**
 * URL serialization utilities
 */
class URLStateManager {
  /**
   * Serialize ColorSpaceView to URL parameters
   * @param {ColorSpaceView} colorSpaceView - The view to serialize
   */
  static serializeColorSpaceViewToURL(colorSpaceView) {
    const params = new URLSearchParams();
    params.set('space', colorSpaceView.colorSpace.getType());
    params.set(colorSpaceView.currentAxis.key, colorSpaceView.currentValue.toString());
    const distanceMetric = colorSpaceView.distanceMetric;
    params.set(
      distanceMetric.id,
      distanceMetric.thresholdToString(colorSpaceView.distanceThreshold));

    const regionsParam = colorSpaceView.showBoundaries ? '' : '&noregions';
    const polarParam = colorSpaceView.usePolarCoordinates ? '&polar' : '';

    // Preserve the 3d parameter if it exists
    const current3dParam = new URLSearchParams(window.location.search).has('3d') ? '&3d' : '';

    const fragment = window.location.hash;
    const newURL = `${window.location.pathname}?${params.toString()}${regionsParam}${polarParam}${current3dParam}${fragment}`;

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
   * Deserialize ColorSpaceView from URL parameters
   * @returns {ColorSpaceView} ColorSpaceView instance, or a default view if parameters are invalid
   */
  static deserializeColorSpaceViewFromURL() {
    const params = new URLSearchParams(window.location.search);

    // Lookup the color space, or default to the first available.
    const spaceParam = params.get('space')?.toUpperCase();
    const colorSpace = getColorSpaceByType(spaceParam) || getAllColorSpaces()[0];

    // Try to find axis and value by looking for axis keys in the URL parameters
    // Set defaults to use if we can't find valid parameters
    let axis = colorSpace.getDefaultAxis();
    let value = axis.defaultValue;

    for (const availableAxis of colorSpace.getAllAxes()) {
      const axisValue = params.get(availableAxis.key);
      if (axisValue !== null) {
        axis = availableAxis;
        const valueIsInteger = axisValue.match(/^-?\d+$/);
        value = valueIsInteger && axis.isValidValue(Number(axisValue))
          ? Number(axisValue) : axis.defaultValue;
        break;
      }
    }

    const showBoundaries = !params.has('noregions');
    const usePolarCoordinates = params.has('polar');

    // Look for distance metric and threshold in URL parameters
    let distanceMetric = getDefaultDistanceMetric();
    let threshold = distanceMetric.maxThreshold;

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

    return new ColorSpaceView(colorSpace, axis, value, showBoundaries, usePolarCoordinates, distanceMetric, threshold);
  }
}


// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ColorSpaceExplorer();
  await app.init();
});
