import { CanvasRenderer } from './canvasRenderer.js';
import { UIController } from './uiController.js';
import { ColorSpaceView, HsvColorSpace, Axis } from './colorSpace.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this.canvas = document.getElementById('colorCanvas');
    this.uiController = new UIController();
    this.hsvColorSpace = new HsvColorSpace();
  }

  async init() {
    // Create renderer with async factory
    this.renderer = await CanvasRenderer.create(this.canvas);

    // Set up UI controller with callback
    this.uiController.setColorSpaceChangeCallback((newColorSpaceView) => {
      this.updateRenderer(newColorSpaceView);
    });

    // Create initial color space view with default hue axis
    const initialColorSpaceView = new ColorSpaceView(
      Axis.HUE,
      this.hsvColorSpace.getDefaultValue(Axis.HUE)
    );
    this.uiController.setupAxisControls(this.hsvColorSpace, initialColorSpaceView);
    this.updateRenderer(initialColorSpaceView);

    // Set up mouse handlers
    this.setupMouseHandlers();

    // Set default UI state
    this.uiController.setDefaultColor();
  }

  updateRenderer(colorSpaceView) {
    this.renderer.renderHsvSpace(colorSpaceView);
  }

  setupMouseHandlers() {
    // Mouse move handler for hover effect
    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Get color at mouse position
      const color = this.renderer.getColorAt(x, y);

      // Update UI
      this.uiController.updateHoveredColor(color);
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
