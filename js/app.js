import { CanvasRenderer } from './canvasRenderer.js';
import { UIController } from './uiController.js';

/**
 * Main application class
 */
class ColorSpaceExplorer {
  constructor() {
    this.canvas = document.getElementById('colorCanvas');
    this.uiController = new UIController();
    this.fixedHue = 180; // Default hue (cyan)
  }

  async init() {
    // Create renderer with async factory
    this.renderer = await CanvasRenderer.create(this.canvas);

    // Render initial color space
    this.renderer.renderHsvSpace(this.fixedHue);

    // Set up mouse hover handling
    this.setupMouseHandlers();

    // Set default UI state
    this.uiController.setDefaultColor();
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
