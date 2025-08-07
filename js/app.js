import { CanvasRenderer } from './canvasRenderer.js';
import { UIController } from './uiController.js';
import { ColorSpaceView, getAllColorSpaces } from './colorSpace.js';
import { ColorPalette } from './colorPalette.js';
import { ColorDisplay } from './colorDisplay.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this._canvas = document.getElementById('colorCanvas');
    const paletteContainer = document.querySelector('.palette-panel');
    this._colorPalette = new ColorPalette(
      paletteContainer,
      () => this._updateRendererFromPalette());

    const colorDisplayContainer = document.querySelector('.color-display-section');
    this._colorDisplay = new ColorDisplay(colorDisplayContainer);
  }

  async init() {
    this._renderer = await CanvasRenderer.create(this._canvas);

    const initialColorSpace = getAllColorSpaces()[0];

    this._uiController = new UIController(
      initialColorSpace, this._updateRenderer.bind(this));

    this._setupMouseHandlers();
  }

  _updateRenderer(colorSpaceView) {
    const paletteColors = this._colorPalette.getColors();
    this._renderer.renderColorSpace(colorSpaceView, paletteColors);
  }

  _updateRendererFromPalette() {
    if (this._uiController) {
      // Get the current color space view from the UI controller
      const currentView = this._uiController.getCurrentColorSpaceView();
      this._updateRenderer(currentView);
    }
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
