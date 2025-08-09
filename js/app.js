import { CanvasRenderer } from './canvasRenderer.js';
import { UIController } from './uiController.js';
import { getAllColorSpaces, ColorSpaceView, getColorSpaceByType } from './colorSpace.js';
import { ColorPalette } from './colorPalette.js';
import { ColorDisplay } from './colorDisplay.js';
import { deferUntilAnimationFrame } from './utils.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this._canvasContainer = document.querySelector('.canvas-container');
    this._debouncedUpdateRenderer = this._createDebouncedUpdater(
      deferUntilAnimationFrame(this._updateRenderer.bind(this)));

    this._selectionIndicator = null;

    const colorDisplayContainer = document.querySelector('.color-display-section');
    this._colorDisplay = new ColorDisplay(colorDisplayContainer);

    const paletteContainer = document.querySelector('.palette-panel');
    this._colorPalette = new ColorPalette(
      paletteContainer,
      this._colorDisplay,
      this._debouncedUpdateRenderer.bind(this));

    // Try to load state from URL, otherwise use defaults
    const initialColorSpaceView = URLStateManager.deserializeColorSpaceViewFromURL();

    this._uiController = new UIController(
      initialColorSpaceView, (options) => {
        this._clearSelection();  // Clear selection on color space change
        this._debouncedUpdateRenderer(options);
      });
  }

  async init() {
    this._renderer = await CanvasRenderer.create(this._canvasContainer);
    this._setupMouseHandlers();
    this._updateRenderer(); // No deferral

    // Initialize selection from URL fragment after renderer has had time to render
    // Use requestAnimationFrame to ensure the render is complete
    const coordinates = URLStateManager.deserializeSelectionFromFragment();
    if (coordinates) {
      requestAnimationFrame(() => {
        this._initializeSelectionFromURL(coordinates);
      });
    }
  }

  /**
   * Initialize selection from URL fragment if coordinates are present
   * @param {Array<number>} coordinates - Canvas coordinates as [x, y]
   */
  _initializeSelectionFromURL(coordinates) {
    const [x, y] = coordinates;

    const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);

    // Set as selected if we have a valid color, otherwise clear selection
    if (rgbColor !== null) {
      this.setSelection(coordinates, rgbColor, closestColor);
    } else {
      this._clearSelection();
    }
  }

  /**
   * Set the selected color
   * @param {Array<number>} coordinates - Canvas coordinates as [x, y]
   * @param {Array<number>} rgbColor - RGB color value as [r, g, b]
   * @param {Array<number>} closestColor - Closest color value as [r, g, b]
   */
  setSelection(coordinates, rgbColor, closestColor) {
    coordinates = coordinates.map(coord => Math.round(coord));

    this._colorDisplay.setSelectedColors(rgbColor, closestColor);
    this._createSelectionIndicator(...coordinates);
    URLStateManager.serializeSelectionToFragment(coordinates);
  }

  /**
   * Clear the current selection
   */
  _clearSelection() {
    if (this._selectionIndicator) {
      this._selectionIndicator.remove();
      this._selectionIndicator = null;
      this._colorDisplay.clearColors();
      URLStateManager.serializeSelectionToFragment(null);
    }
  }

  /**
   * Creates a debounced function that can handle delayed execution
   * @param {Function} func - The function to debounce
   * @returns {Function} The debounced function
   */
  _createDebouncedUpdater(func) {
    let timeoutId = null;

    return (options) => {
      const delayMs = options?.delayMs;

      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (delayMs && delayMs > 0) {
        // Set up delayed execution
        timeoutId = setTimeout(() => {
          func(options);
          timeoutId = null;
        }, delayMs);
      } else {
        // Immediate execution
        func(options);
      }
    };
  }

  _updateRenderer(options) {
    if (!this._renderer) return;
    const colorSpaceView = this._uiController.getCurrentColorSpaceView();
    const paletteColors = this._colorPalette.getColors();
    this._renderer.renderColorSpace(
      colorSpaceView,
      paletteColors,
      options?.highlightIndex);

    // Serialize state to URL whenever we render
    URLStateManager.serializeColorSpaceViewToURL(colorSpaceView);
  }

  _setupMouseHandlers() {
    const getCanvasCoordsFromMouseEvent = (event) => {
      const rect = this._canvasContainer.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return [x, y];
    };

    const deferredSetColors = deferUntilAnimationFrame(
      this._colorDisplay.setColors.bind(this._colorDisplay));

    // Mouse move handler for hover effect
    this._canvasContainer.addEventListener('mousemove', (event) => {
      // Skip hover updates if there's a selection
      if (this._selectionIndicator) return;

      const [x, y] = getCanvasCoordsFromMouseEvent(event);
      const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);

      if (rgbColor === null) {
        this._colorDisplay.clearColors();
        return;
      }

      deferredSetColors(rgbColor, closestColor);
    });

    // Mouse leave handler to reset to default
    this._canvasContainer.addEventListener('mouseleave', () => {
      // Skip clearing if there's a selection
      if (this._selectionIndicator) return;

      this._colorDisplay.clearColors();
    });

    // Click handler for canvas panel
    const centerPanel = document.querySelector('.canvas-panel');
    centerPanel.addEventListener('click', (event) => {
      const selectionClicked = event.target === this._selectionIndicator;
      const [x, y] = getCanvasCoordsFromMouseEvent(event);
      const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);

      // Handle command-click or ctrl-click for direct color addition
      if ((event.metaKey || event.ctrlKey)) {
        // Try to add the color to the palette
        if (rgbColor !== null && this._colorPalette.addColor(rgbColor, closestColor)) {
          // Show brief visual feedback at click location
          this._showAddFeedback(x, y);
        }
        return; // Don't proceed with normal click handling
      }

      this._clearSelection();

      if (rgbColor === null) {
        this._colorDisplay.clearColors();
        return;
      }

      if (!selectionClicked) {
        this.setSelection([x, y], rgbColor, closestColor);
      } else {
        deferredSetColors(rgbColor, closestColor);
      }
    });
  }

  /**
   * Create visual selection indicator
   * @param {number} x - X coordinate relative to canvas
   * @param {number} y - Y coordinate relative to canvas
   */
  _createSelectionIndicator(x, y) {
    this._clearSelection();

    // Create indicator element positioned absolutely within canvas container
    this._selectionIndicator = document.createElement('div');
    this._selectionIndicator.className = 'selection-indicator';

    // Position absolutely within the canvas container (CSS handles centering)
    this._selectionIndicator.style.left = `${x}px`;
    this._selectionIndicator.style.top = `${y}px`;

    // Append to canvas container
    this._canvasContainer.appendChild(this._selectionIndicator);
  }

  /**
   * Show brief visual feedback when a color is added via command-click
   * @param {number} x - X coordinate relative to canvas
   * @param {number} y - Y coordinate relative to canvas
   */
  _showAddFeedback(x, y) {
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = 'add-feedback';

    // Position absolutely within the canvas container
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;

    // Append to canvas container
    this._canvasContainer.appendChild(feedback);

    // Remove after animation completes
    setTimeout(() => { feedback.remove(); }, 800);
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
    const regionsParam = colorSpaceView.showBoundaries ? '&regions' : '';
    const polarParam = colorSpaceView.usePolarCoordinates ? '&polar' : '';

    const fragment = window.location.hash;
    const newURL = `${window.location.pathname}?${params.toString()}${regionsParam}${polarParam}${fragment}`;

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
    const spaceParam = params.get('space').toUpperCase();
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
          ? axisValue : axis.defaultValue;
        break;
      }
    }

    const showBoundaries = params.has('regions');
    const usePolarCoordinates = params.has('polar');

    return new ColorSpaceView(colorSpace, axis, value, showBoundaries, usePolarCoordinates);
  }
}


// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ColorSpaceExplorer();
  await app.init();
});
