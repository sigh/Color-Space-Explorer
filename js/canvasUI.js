import { CubeRenderer } from './cubeRenderer.js';

/**
 * Handles mouse interactions and UI elements for the canvas
 */
export class CanvasUI {
  constructor(canvasPanel, renderer, colorDisplay, colorPalette, urlStateManager) {
    this._canvasContainer = canvasPanel.querySelector('.canvas-container');
    this._renderer = renderer;
    this._colorDisplay = colorDisplay;
    this._colorPalette = colorPalette;
    this._urlStateManager = urlStateManager;
    this._selectionIndicator = null;

    this._setupMouseHandlers(canvasPanel);
    this._initializeSelectionFromURL();
  }

  /**
   * Set up mouse event handlers for the canvas
   */
  _setupMouseHandlers(canvasPanel) {
    // Check if we're using 3D renderer
    const is3DRenderer = this._renderer instanceof CubeRenderer;

    // Mouse move handler for hover effect (skip for 3D renderer)
    this._canvasContainer.addEventListener('mousemove', (event) => {
      const [x, y] = this._getCanvasCoordsFromMouseEvent(event);
      const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);

      this._canvasContainer.style.cursor = rgbColor ? 'crosshair' : 'default';

      // Skip hover updates if there's a selection
      if (this._selectionIndicator) {
        if (event.target === this._selectionIndicator) {
          // Change back to default to indicate that clicking will clear
          // the selection.
          this._canvasContainer.style.cursor = 'default';
        }
        return;
      }

      if (rgbColor === null) {
        this._colorDisplay.clearColors();
        return;
      }

      this._colorDisplay.setColors(rgbColor, closestColor);
    });

    // Mouse leave handler to reset to default (skip for 3D renderer)
    this._canvasContainer.addEventListener('mouseleave', () => {
      // Skip clearing if there's a selection
      if (this._selectionIndicator) return;

      this._colorDisplay.clearColors();
    });

    // Click handler for canvas panel (skip for 3D renderer)
    canvasPanel.addEventListener('click', (event) => {
      if (is3DRenderer) return; // Let 3D renderer handle its own mouse events

      const selectionClicked = event.target === this._selectionIndicator;
      const [x, y] = this._getCanvasCoordsFromMouseEvent(event);
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
        this._setSelection([x, y], rgbColor, closestColor);
      } else {
        this._colorDisplay.setColors(rgbColor, closestColor);
      }
    });
  }

  /**
   * Get canvas coordinates from mouse event
   * @param {MouseEvent} event - Mouse event
   * @returns {Array<number>} Canvas coordinates as [x, y]
   */
  _getCanvasCoordsFromMouseEvent(event) {
    const rect = this._canvasContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return [x, y];
  }

  /**
   * Set the selected color
   * @param {Array<number>} coordinates - Canvas coordinates as [x, y]
   * @param {RgbColor} rgbColor - RGB color object
   * @param {NamedColor} closestColor - Closest named color object
   */
  _setSelection(coordinates, rgbColor, closestColor) {
    this._placeSelectionIndicator(...coordinates);
    this._colorDisplay.setSelectedColors(rgbColor, closestColor);
    this._urlStateManager.serializeSelectionToFragment(coordinates);
  }

  /**
   * Clear the current selection
   */
  _clearSelection() {
    if (this._selectionIndicator) {
      this._selectionIndicator.remove();
      this._selectionIndicator = null;
      this._colorDisplay.clearColors();
      this._urlStateManager.serializeSelectionToFragment(null);
    }
  }

  /**
   * Initialize selection from URL fragment if coordinates are present
   */
  _initializeSelectionFromURL() {
    const selectionCoords = this._urlStateManager.deserializeSelectionFromFragment();
    if (selectionCoords) {
      this._placeSelectionIndicator(...selectionCoords);
    }
  }

  /**
   * Create visual selection indicator
   * @param {number} x - X coordinate relative to canvas
   * @param {number} y - Y coordinate relative to canvas
   */
  _placeSelectionIndicator(x, y) {
    if (!this._selectionIndicator) {
      // Create indicator element positioned absolutely within canvas container
      this._selectionIndicator = document.createElement('div');
      this._selectionIndicator.className = 'selection-indicator';

      // Append to canvas container
      this._canvasContainer.appendChild(this._selectionIndicator);
    }

    x = Math.round(x);
    y = Math.round(y);

    // Position absolutely within the canvas container (CSS handles centering)
    this._selectionIndicator.style.left = `${x}px`;
    this._selectionIndicator.style.top = `${y}px`;

    // Store the coordinates in the data attribute
    this._selectionIndicator.dataset.coordinates = `${x},${y}`;
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

  /**
   * Recalculate selection after renderer updates
   * This should be called after the renderer has updated to ensure
   * the selection indicator points to valid content.
   */
  async recalculateSelection() {
    if (!this._selectionIndicator) return;

    // Use requestAnimationFrame to ensure the render is complete
    await this._renderer.waitForCurrentRender();

    // Check that we still have a selection indicator after waiting
    if (!this._selectionIndicator) return;
    const coordinates = this._selectionIndicator.dataset.coordinates?.split(',').map(Number);
    if (!coordinates) return;

    const [rgbColor, closestColor] = this._renderer.getColorAt(...coordinates);

    // Set as selected if we have a valid color, otherwise clear selection
    if (rgbColor !== null) {
      this._setSelection(coordinates, rgbColor, closestColor);
    } else {
      this._clearSelection();
    }
  }
}
