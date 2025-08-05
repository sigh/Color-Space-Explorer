import { getAllColorSpaces } from "./colorSpace.js";

/**
 * WebGL Canvas renderer for color spaces
 */
export class CanvasRenderer {
  constructor(canvas, vertexShaderSource, fragmentShaderSource) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.width = canvas.width;
    this.height = canvas.height;

    this.initWebGL(vertexShaderSource, fragmentShaderSource);
  }

  /**
   * Factory function to create a CanvasRenderer with shader loading
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @returns {Promise<CanvasRenderer>} - Promise that resolves to initialized renderer
   */
  static async create(canvas) {
    // Load shaders from files
    const [vertexShaderSource, fragmentShaderSource] = await Promise.all([
      fetch('./shaders/vertex.glsl').then(r => r.text()),
      fetch('./shaders/fragment.glsl').then(r => r.text())
    ]);

    return new CanvasRenderer(canvas, vertexShaderSource, fragmentShaderSource);
  }

  /**
   * Initialize WebGL shaders and buffers
   */
  initWebGL(vertexShaderSource, fragmentShaderSource) {
    // Create and compile shaders
    this.vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    this.fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Create and link program
    this.program = this.createProgram(this.vertexShader, this.fragmentShader);

    // Get attribute and uniform locations
    this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
    this.fixedValueLocation = this.gl.getUniformLocation(this.program, 'u_fixedValue');
    this.axisIndexLocation = this.gl.getUniformLocation(this.program, 'u_axisIndex');
    this.colorSpaceIndexLocation = this.gl.getUniformLocation(this.program, 'u_colorSpaceIndex');

    // Create buffers, set up vertex attributes, and set viewport
    this.setupBuffersAndAttributes();
    this.gl.viewport(0, 0, this.width, this.height);
  }

  /**
   * Create and compile a shader
   */
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Error compiling shader:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Create and link shader program
   */
  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Error linking program:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  /**
   * Set up vertex buffer and attributes (done once during initialization)
   */
  setupBuffersAndAttributes() {
    const gl = this.gl;

    // Full screen quad vertices and texture coordinates
    const quadData = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,  // bottom-left
      1.0, -1.0, 1.0, 0.0,  // bottom-right
      -1.0, 1.0, 0.0, 1.0,  // top-left
      1.0, 1.0, 1.0, 1.0,  // top-right
    ]);

    // Create and bind buffer
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

    // Set up vertex attributes
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 16, 8);
  }

  /**
   * Render color space with fixed axis using WebGL
   * @param {ColorSpaceView} colorSpaceView - Immutable color space view
   */
  renderColorSpace(colorSpaceView) {
    this.gl.useProgram(this.program);

    const colorSpace = colorSpaceView.colorSpace;
    const currentAxisIndex = colorSpace.getAxisIndex(
      colorSpaceView.currentAxis);

    // Normalize the fixed value to 0-1 range
    const axis = colorSpaceView.currentAxis;
    const normalizedFixedValue = colorSpaceView.currentValue / axis.max;

    const colorSpaceIndex = getAllColorSpaces().indexOf(colorSpace);

    this.gl.uniform1i(this.axisIndexLocation, currentAxisIndex);
    this.gl.uniform1f(this.fixedValueLocation, normalizedFixedValue);
    this.gl.uniform1i(this.colorSpaceIndexLocation, colorSpaceIndex);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Get color at canvas coordinates by reading from the canvas
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object} RGB bytes color {r, g, b} (0-255 values)
   */
  getColorAt(x, y) {
    const gl = this.gl;

    // Clamp coordinates to canvas bounds
    x = Math.max(0, Math.min(x, this.width - 1));
    y = Math.max(0, Math.min(y, this.height - 1));

    // WebGL coordinates are flipped vertically
    const glY = this.height - 1 - y;

    // Read pixel data from framebuffer
    const pixels = new Uint8Array(4);
    gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    return {
      r: pixels[0],
      g: pixels[1],
      b: pixels[2],
    };
  }
}
