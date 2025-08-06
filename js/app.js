import { CanvasRenderer } from './canvasRenderer.js';
import { UIController } from './uiController.js';
import { ColorSpaceView, getAllColorSpaces } from './colorSpace.js';
import { ColorPalette } from './colorPalette.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this._canvas = document.getElementById('colorCanvas');
    this._uiController = new UIController();
    const paletteContainer = document.querySelector('.palette-panel');
    this._colorPalette = new ColorPalette(paletteContainer);
  }

  async init() {
    // Create renderer with async factory
    this._renderer = await CanvasRenderer.create(this._canvas);

    // Set up UI controller with callback
    this._uiController.setColorSpaceChangeCallback((newColorSpaceView) => {
      this._updateRenderer(newColorSpaceView);
    });

    // Set up the initial color space
    const colorSpaces = getAllColorSpaces();
    const initialColorSpace = colorSpaces.find(cs => cs.getType() === 'HSV');
    const defaultAxis = initialColorSpace.getDefaultAxis();
    const initialColorSpaceView = new ColorSpaceView(
      initialColorSpace,
      defaultAxis,
      defaultAxis.defaultValue
    );
    this._uiController.setupAxisControls(initialColorSpaceView);

    // Set up mouse handlers
    this._setupMouseHandlers();

    // Set default UI state
    this._uiController.setDefaultColor();
  }

  _updateRenderer(colorSpaceView) {
    this._renderer.renderColorSpace(colorSpaceView);
  }

  _setupMouseHandlers() {
    // Mouse move handler for hover effect
    this._canvas.addEventListener('mousemove', (event) => {
      const rect = this._canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const rgbBytes = this._renderer.getColorAt(x, y);

      // Update UI
      this._uiController.updateHoveredColor(rgbBytes);
    });

    // Mouse leave handler to reset to default
    this._canvas.addEventListener('mouseleave', () => {
      this._uiController.setDefaultColor();
    });
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ColorSpaceExplorer();
  await app.init();
});
