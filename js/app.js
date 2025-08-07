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
    this._colorPalette = new ColorPalette(paletteContainer);

    const colorDisplayContainer = document.querySelector('.color-display-section');
    this._colorDisplay = new ColorDisplay(colorDisplayContainer);
  }

  async init() {
    this._renderer = await CanvasRenderer.create(this._canvas);

    const initialColorSpaceView = this._makeInitialColorSpaceView();

    this._uiController = new UIController(
      initialColorSpaceView, this._updateRenderer.bind(this));

    this._setupMouseHandlers();
  }

  _makeInitialColorSpaceView() {
    const initialColorSpace = getAllColorSpaces()[0];
    const defaultAxis = initialColorSpace.getDefaultAxis();
    return new ColorSpaceView(
      initialColorSpace,
      defaultAxis,
      defaultAxis.defaultValue
    );
  }

  _updateRenderer(colorSpaceView) {
    const paletteColors = this._colorPalette.getColors();
    this._renderer.renderColorSpace(colorSpaceView, paletteColors);
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
