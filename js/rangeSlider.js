import { createElement } from './utils.js';

/**
 * Multi-range slider component - supports 1 to n thumbs
 */
export class RangeSlider {
  /**
   * Create a new RangeSlider instance
   * @param {HTMLElement} parent - The parent element to append the slider to
   * @param {Object} options - Configuration options for the slider
   * @param {number} [options.min=0] - Minimum value for the slider
   * @param {number} [options.max=100] - Maximum value for the slider
   * @param {number[]} [options.numThumbs=1] - Number of thumbs
   * @param {Function} [options.onChange] - Callback function called when values change
   */
  constructor(parent, options = {}) {
    this._options = {
      min: 0,
      max: 100,
      numThumbs: 1,
      onChange: () => { },
      ...options
    };

    this._values = Array.from(
      { length: this._options.numThumbs },
      () => this._options.min);
    this._thumbs = [];

    parent.appendChild(this._createElement());

    this._updatePositions();
    this._setupEventListeners();
  }

  /**
   * Create the DOM elements for the slider
   * @return {HTMLElement} The container element for the slider
   * @private
   */
  _createElement() {
    this._container = createElement('div');
    this._container.className = 'range-slider-track';

    const track = createElement('div');
    track.className = 'range-slider-background';

    // Add background first
    this._container.appendChild(track);

    // Create single active range (only for multi-thumb sliders)
    this._activeRange = null;
    if (this._values.length > 1) {
      this._activeRange = createElement('div');
      this._activeRange.className = 'range-slider-active';
      this._container.appendChild(this._activeRange);
    }

    // Create thumbs (on top)
    for (let i = 0; i < this._values.length; i++) {
      const thumb = createElement('div');
      thumb.className = 'range-slider-thumb';
      thumb.dataset.index = i;
      this._thumbs.push(thumb);
      this._container.appendChild(thumb);
    }

    return this._container;
  }

  /**
   * Set up event listeners for pointer interactions
   * @private
   */
  _setupEventListeners() {
    // Prevent default touch behaviors on the slider
    this._container.style.touchAction = 'none';

    let dragTarget = null;
    let pointerId = null;

    const startDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Capture the pointer to receive subsequent events
      this._container.setPointerCapture(e.pointerId);
      pointerId = e.pointerId;

      const x = e.clientX - this._container.getBoundingClientRect().left;
      const value = this._positionToValue(x);

      // Find the closest thumb to start dragging
      const closestIndex = this._findClosestThumb(value);

      // Move the closest thumb to the clicked position
      this._values[closestIndex] = value;
      dragTarget = closestIndex;

      this._updatePositions();
      this._options.onChange(...this._values);
    };

    const stopDrag = (e) => {
      if (pointerId !== null && pointerId === e.pointerId) {
        // Release the pointer capture
        this._container.releasePointerCapture(e.pointerId);
        dragTarget = null;
        pointerId = null;
      }
    };

    const handlePointerMove = (e) => {
      if (dragTarget === null || pointerId !== e.pointerId) return;

      // Prevent scrolling during slider drag
      e.preventDefault();
      e.stopPropagation();

      const x = e.clientX - this._container.getBoundingClientRect().left;
      const value = this._positionToValue(x);

      // Update the dragged thumb's value
      this._values[dragTarget] = value;

      this._updatePositions();
      this._options.onChange(...this._values);
    };

    const handleDoubleClick = (e) => {
      e.preventDefault();

      if (this._values.length === 1) {
        // Single slider: set to max
        this._values[0] = this._options.max;
      } else {
        // Multi-thumb slider: set range to min and max
        this._values[0] = this._options.min;
        this._values[this._values.length - 1] = this._options.max;
      }

      this._updatePositions();
      this._options.onChange(...this._values);
    };

    this._container.addEventListener('pointerdown', startDrag);
    this._container.addEventListener('pointermove', handlePointerMove);
    this._container.addEventListener('pointerup', stopDrag);
    this._container.addEventListener('pointercancel', stopDrag);
    this._container.addEventListener('dblclick', handleDoubleClick);
  }

  /**
   * Convert mouse position to slider value
   * @param {number} x - Mouse x position relative to track
   * @returns {number} Calculated slider value
   * @private
   */
  _positionToValue(x) {
    const rect = this._container.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const range = this._options.max - this._options.min;
    const rawValue = this._options.min + (percentage * range);
    const steppedValue = Math.round(rawValue);  // step = 1
    return this._clampValue(steppedValue);
  }

  /**
   * Clamp a value to the slider's min/max range
   * @param {number} value - Value to clamp
   * @returns {number} Clamped value
   * @private
   */
  _clampValue(value) {
    return Math.max(this._options.min, Math.min(this._options.max, value));
  }

  /**
   * Find the index of the thumb closest to a value
   * @param {number} value - Target value
   * @returns {number} Index of closest thumb
   * @private
   */
  _findClosestThumb(value) {
    let closestIndex = 0;
    let closestDistance = Math.abs(value - this._values[0]);

    for (let i = 1; i < this._values.length; i++) {
      const distance = Math.abs(value - this._values[i]);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  /**
   * Update the visual positions of thumbs and active range
   * @private
   */
  _updatePositions() {
    // Clamp values to the slider's range
    this._values = this._values.map(value => this._clampValue(value));

    // Order the values.
    this._values.sort((a, b) => a - b);

    const range = this._options.max - this._options.min;

    // Update thumb positions
    this._thumbs.forEach((thumb, index) => {
      const percent = ((this._values[index] - this._options.min) / range) * 100;
      thumb.style.left = `${percent}%`;
    });

    // Update active range (only for multi-thumb sliders)
    if (this._activeRange && this._values.length > 1) {
      const leftPercent = ((Math.min(...this._values) - this._options.min) / range) * 100;
      const rightPercent = ((Math.max(...this._values) - this._options.min) / range) * 100;

      this._activeRange.style.left = `${leftPercent}%`;
      this._activeRange.style.width = `${rightPercent - leftPercent}%`;
    }
  }

  /**
   * Get all current values of the slider
   * @returns {number[]} Array of current values
   */
  getValues() {
    return [...this._values];
  }

  /**
   * Set values for all thumbs
   * @param {number[]} values - Array of values to set
   */
  setValues(values) {
    this._values = values;

    this._updatePositions();
    this._options.onChange(...this._values);
  }

  /**
   * Get the value of the first thumb (convenience method for single-thumb sliders)
   * @returns {number} The value of the first thumb
   */
  getValue() {
    return this._values[0];
  }

  /**
   * Set the value of the first thumb (convenience method for single-thumb sliders)
   * @param {number} value - The value to set
   */
  setValue(value) {
    this.setValues([value]);
  }

  /**
   * Set the min and max range for the slider
   * @param {number} min - The new minimum value
   * @param {number} max - The new maximum value
   */
  setRange(min, max) {
    if (min >= max) {
      throw new Error('Min value must be less than max value');
    }

    this._options.min = min;
    this._options.max = max;

    this._updatePositions();
  }

  /**
   * Remove the slider from the DOM
   */
  destroy() {
    this._container?.parentNode?.removeChild(this._container);
  }
}