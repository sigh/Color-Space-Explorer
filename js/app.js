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
    this._canvasContainer = document.querySelector('.canvas-container');
    this._debouncedUpdateRenderer = this._createDebouncedUpdater((options) => {
      this._updateRenderer(options);
    });

    this._selectionIndicator = null;

    const colorDisplayContainer = document.querySelector('.color-display-section');
    this._colorDisplay = new ColorDisplay(colorDisplayContainer);

    const paletteContainer = document.querySelector('.palette-panel');
    this._colorPalette = new ColorPalette(
      paletteContainer,
      this._colorDisplay,
      this._debouncedUpdateRenderer.bind(this));

    const initialColorSpace = getAllColorSpaces()[0];
    this._uiController = new UIController(
      initialColorSpace, (options) => {
        this._clearSelection();  // Clear selection on color space change
        this._debouncedUpdateRenderer(options);
      });
  }

  async init() {
    this._renderer = await CanvasRenderer.create(this._canvasContainer);
    this._setupMouseHandlers();
    this._debouncedUpdateRenderer();
  }

  /**
   * Clear the current selection
   */
  _clearSelection() {
    if (this._selectionIndicator) {
      this._selectionIndicator.remove();
      this._selectionIndicator = null;
      this._colorDisplay.clearColors();
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
  }

  _setupMouseHandlers() {
    const getMouseCoords = (event) => {
      const rect = this._canvasContainer.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return [x, y];
    };

    const setColorForMouseEvent = (event, isSelecting) => {
      const [x, y] = getMouseCoords(event);

      const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);

      if (isSelecting) {
        this._colorDisplay.setSelectedColors(rgbColor, closestColor);
        this._createSelectionIndicator(x, y);
      } else {
        this._colorDisplay.setColors(rgbColor, closestColor);
      }
    };

    // Mouse move handler for hover effect
    this._canvasContainer.addEventListener('mousemove', (event) => {
      // Skip hover updates if there's a selection
      if (this._selectionIndicator) return;

      setColorForMouseEvent(event, false);
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
      const canvasClicked = this._canvasContainer.contains(event.target);

      if (!canvasClicked) {
        this._clearSelection();
        return;
      }

      // Handle command-click (or ctrl-click on Windows) for direct color addition
      if ((event.metaKey || event.ctrlKey)) {
        const [x, y] = getMouseCoords(event);
        const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);

        // Directly add color to palette without going through color display
        const success = this._colorPalette.addColor(rgbColor, closestColor);
        if (success) {
          // Show brief visual feedback at click location
          this._showAddFeedback(x, y);
        }
        return; // Don't proceed with normal click handling
      }

      this._clearSelection();
      setColorForMouseEvent(event, !selectionClicked);
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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new ColorSpaceExplorer();
  await app.init();
});
