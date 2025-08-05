import { hsvToRgb, rgbToBytes } from './colorUtils.js';

/**
 * Canvas renderer for color spaces
 */
export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.imageData = this.ctx.createImageData(this.width, this.height);
  }

  /**
   * Render HSV color space with fixed hue
   * @param {number} fixedHue - Hue value (0-360)
   */
  renderHsvSpace(fixedHue = 180) {
    const data = this.imageData.data;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // Map canvas coordinates to HSV values
        const saturation = x / this.width; // 0 to 1
        const value = 1 - (y / this.height); // 1 to 0 (top to bottom)

        // Convert HSV to RGB (0-1 values)
        const rgb = hsvToRgb(fixedHue, saturation, value);
        const rgbBytes = rgbToBytes(rgb.r, rgb.g, rgb.b);

        // Set pixel data
        const index = (y * this.width + x) * 4;
        data[index] = rgbBytes.r;     // Red
        data[index + 1] = rgbBytes.g; // Green
        data[index + 2] = rgbBytes.b; // Blue
        data[index + 3] = 255;        // Alpha
      }
    }

    // Draw the image data to canvas
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Get color at canvas coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} fixedHue - Current fixed hue value
   * @returns {Object} RGB color {r, g, b} (0-1 values)
   */
  getColorAt(x, y, fixedHue = 180) {
    // Map canvas coordinates to HSV values
    const saturation = x / this.width;
    const value = 1 - (y / this.height);

    // Convert HSV to RGB (returns 0-1 values)
    return hsvToRgb(fixedHue, saturation, value);
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
