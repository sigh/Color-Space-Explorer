// Import gl-matrix for 3D rotation matrix operations
import '../lib/gl-matrix-min.js';
const { mat4 } = glMatrix;

/**
 * Handles mouse interactions and UI elements for the canvas
 */
export class CanvasUI {
  constructor(canvasPanel, renderer, colorDisplay, colorPalette, urlStateManager, onRotationChange) {
    this._canvasContainer = canvasPanel.querySelector('.canvas-container');
    this._renderer = renderer;
    this._colorDisplay = colorDisplay;
    this._colorPalette = colorPalette;
    this._urlStateManager = urlStateManager;
    this._onRotationChange = onRotationChange;
    this._render3d = false;
    this._selectionIndicator = null;

    // 3D rotation matrix for cube renderer
    // Initialize with white corner tilted towards camera
    this._rotationMatrix = mat4.create();
    mat4.fromXRotation(this._rotationMatrix, 30 * (Math.PI / 180)); // tilt 30° towards camera
    mat4.rotateY(this._rotationMatrix, this._rotationMatrix, -30 * (Math.PI / 180));

    this._setupMouseHandlers(canvasPanel);
    this._initializeSelectionFromURL();
  }

  /**
   * Set up pointer event handlers for the canvas
   */
  _setupMouseHandlers(canvasPanel) {
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let activePrimaryPointerId = null;

    // Prevent default touch behaviors on the canvas (stops scrolling)
    canvasPanel.style.touchAction = 'none';

    const setCursor = (isOverColor) => {
      if (isDragging && this._render3d) return;
      canvasPanel.style.cursor = isOverColor ? 'crosshair' : 'default';
    }

    const pointerDownHandler = (event) => {
      // Only handle primary pointer (first touch or left mouse button)
      if (event.isPrimary) {
        // Prevent scrolling and other default touch behaviors
        // Prevent all default behaviors
        event.preventDefault();
        event.stopPropagation();

        canvasPanel.setPointerCapture(event.pointerId);
        activePrimaryPointerId = event.pointerId;
        isDragging = true;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
      }
    };

    const pointerDragHandler = (event) => {
      const deltaX = event.clientX - lastPointerX;
      const deltaY = event.clientY - lastPointerY;

      // Create incremental rotation matrices and apply them to current rotation
      const rotationSpeed = 0.01;
      const deltaRotation = mat4.create();

      // Apply world Y rotation
      mat4.fromYRotation(deltaRotation, deltaX * rotationSpeed);
      mat4.multiply(this._rotationMatrix, deltaRotation, this._rotationMatrix);

      // Apply world X rotation
      mat4.fromXRotation(deltaRotation, deltaY * rotationSpeed);
      mat4.multiply(this._rotationMatrix, deltaRotation, this._rotationMatrix);

      // Trigger re-render with rotation via callback
      if (this._onRotationChange) {
        this._onRotationChange();
      }
    }

    const pointerMoveHandler = (event) => {
      // Handle 3D rotation if dragging with primary pointer
      if (isDragging && event.pointerId === activePrimaryPointerId) {
        // Prevent scrolling during drag operations
        event.preventDefault();
        event.stopPropagation();

        if (this._render3d) {
          canvasPanel.style.cursor = 'grab';
          pointerDragHandler(event);
        }

        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
      }

      // Only show hover effects for primary pointer (avoid issues with multi-touch)
      if (event.isPrimary) {
        const [x, y] = this._getCanvasCoordsFromPointerEvent(event);
        const [rgbColor, closestColor] = this._renderer.getColorAt(x, y);
        setCursor(rgbColor !== null);

        // Skip hover updates if there's a selection
        if (this._selectionIndicator) {
          if (event.target === this._selectionIndicator) {
            // Change back to default to indicate that clicking will clear
            // the selection.
            setCursor(false);
          }
          return;
        }

        if (rgbColor === null) {
          this._colorDisplay.clearColors();
          return;
        }

        this._colorDisplay.setColors(rgbColor, closestColor);
      }
    };

    const pointerUpHandler = (event) => {
      if (event.pointerId === activePrimaryPointerId) {
        canvasPanel.releasePointerCapture(event.pointerId);
        isDragging = false;
        activePrimaryPointerId = null;

        if (this._render3d) {
          const [x, y] = this._getCanvasCoordsFromPointerEvent(event);
          const [rgbColor] = this._renderer.getColorAt(x, y);
          setCursor(rgbColor !== null);
        }
        event.stopPropagation();
      }
    };

    const pointerCancelHandler = (event) => {
      if (event.pointerId === activePrimaryPointerId) {
        isDragging = false;
        activePrimaryPointerId = null;
        canvasPanel.style.removeProperty('cursor');
        // Skip clearing if there's a selection
        if (this._selectionIndicator) return;
        this._colorDisplay.clearColors();
      }
    };

    const pointerLeaveHandler = (event) => {
      if (event.pointerId === activePrimaryPointerId) {
        isDragging = false;
        activePrimaryPointerId = null;
        canvasPanel.style.removeProperty('cursor');
        // Skip clearing if there's a selection
        if (this._selectionIndicator) return;
        this._colorDisplay.clearColors();
      }
    };

    // Click handler - only active in 2D mode
    const clickHandler = (event) => {
      if (this._render3d) return; // No click handling in 3D mode

      const selectionClicked = event.target === this._selectionIndicator;
      const [x, y] = this._getCanvasCoordsFromPointerEvent(event);
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
        setCursor(false);
      } else {
        this._colorDisplay.setColors(rgbColor, closestColor);
        setCursor(true);
      }
    };

    canvasPanel.addEventListener('pointerdown', pointerDownHandler);
    canvasPanel.addEventListener('pointermove', pointerMoveHandler);
    canvasPanel.addEventListener('pointerup', pointerUpHandler);
    canvasPanel.addEventListener('pointercancel', pointerCancelHandler);
    canvasPanel.addEventListener('pointerleave', pointerLeaveHandler);
    canvasPanel.addEventListener('click', clickHandler);
  }

  /**
   * Update mode (for toggling between 2D/3D)
   * @param {boolean} render3d - Whether using 3D mode
   */
  setRender3d3d(render3d) {
    this._render3d = render3d;
    this._clearSelection();
  }

  /**
   * Get the current rotation matrix for 3D rendering
   * @returns {Float32Array} The 4x4 rotation matrix
   */
  getRotationMatrix() {
    return this._rotationMatrix;
  }

  /**
   * Get canvas coordinates from pointer event
   * @param {PointerEvent} event - Pointer event
   * @returns {Array<number>} Canvas coordinates as [x, y]
   */
  _getCanvasCoordsFromPointerEvent(event) {
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
