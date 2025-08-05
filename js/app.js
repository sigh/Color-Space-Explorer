import { CanvasRenderer } from './canvasRenderer.js';
import { UIController } from './uiController.js';
import { ColorSpaceView, getAllColorSpaces } from './colorSpace.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this.canvas = document.getElementById('colorCanvas');
    this.uiController = new UIController();
  }

  async init() {
    // Create renderer with async factory
    this.renderer = await CanvasRenderer.create(this.canvas);

    // Set up UI controller with callback
    this.uiController.setColorSpaceChangeCallback((newColorSpaceView) => {
      this.updateRenderer(newColorSpaceView);
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
    this.uiController.setupAxisControls(initialColorSpaceView);

    // Set up mouse handlers
    this.setupMouseHandlers();

    // Set default UI state
    this.uiController.setDefaultColor();
  }

  updateRenderer(colorSpaceView) {
    this.renderer.renderColorSpace(colorSpaceView);
  }

  setupMouseHandlers() {
    // Mouse move handler for hover effect
    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const rgbBytes = this.renderer.getColorAt(x, y);

      // Update UI
      this.uiController.updateHoveredColor(rgbBytes);
    });

    // Mouse leave handler to reset to default
    this.canvas.addEventListener('mouseleave', () => {
      this.uiController.setDefaultColor();
    });
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ColorSpaceExplorer();
  await app.init();
});
