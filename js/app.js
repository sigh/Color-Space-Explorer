import { CanvasRenderer } from './canvasRenderer.js';
import { UIController } from './uiController.js';
import { getAllColorSpaces } from './colorSpace.js';
import { ColorPalette } from './colorPalette.js';
import { ColorDisplay } from './colorDisplay.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this._canvas = document.getElementById('colorCanvas');
    this._debouncedUpdateRenderer = this._createDebouncedUpdater((options) => {
      this._updateRenderer(options);
    });

    const paletteContainer = document.querySelector('.palette-panel');
    this._colorPalette = new ColorPalette(
      paletteContainer,
      this._debouncedUpdateRenderer.bind(this));

    const initialColorSpace = getAllColorSpaces()[0];
    this._uiController = new UIController(
      initialColorSpace, this._debouncedUpdateRenderer.bind(this));

    const colorDisplayContainer = document.querySelector('.color-display-section');
    this._colorDisplay = new ColorDisplay(colorDisplayContainer);
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

  async init() {
    this._renderer = await CanvasRenderer.create(this._canvas);
    this._setupMouseHandlers();
    this._debouncedUpdateRenderer();
  }

  _updateRenderer(options) {
    if (!this._renderer) return;
    const colorSpaceView = this._uiController.getCurrentColorSpaceView();
    const paletteColors = this._colorPalette.getColors();
    this._renderer.renderColorSpace(
      colorSpaceView,
      paletteColors,
      options?.highlightIndex);
  }

  _setupMouseHandlers() {
    // Mouse move handler for hover effect
    this._canvas.addEventListener('mousemove', (event) => {
      const rect = this._canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);

      // Update color display
      this._colorDisplay.updateHoveredColor(rgbColor);
      this._colorDisplay.updateClosestColor(closestColor);
    });

    // Mouse leave handler to reset to default
    this._canvas.addEventListener('mouseleave', () => {
      this._colorDisplay.clear();
    });
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ColorSpaceExplorer();
  await app.init();
});
