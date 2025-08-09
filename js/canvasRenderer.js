import { getAllColorSpaces, RgbColor } from "./colorSpace.js";
import { clearElement, createElement } from "./utils.js";

/**
 * WebGL2 Canvas renderer for color spaces with framebuffer rendering
 */
export class CanvasRenderer {
  constructor(canvasContainer, vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource) {
    const canvas = canvasContainer.querySelector('canvas');
    this._gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });

    if (!this._gl) {
      throw new Error('WebGL2 not supported');
    }

    this._width = canvas.width;
    this._height = canvas.height;
    this._paletteColors = []; // The palette colors used for indexing.

    // Create axis container for labels and tick marks
    this._axisContainer = document.createElement('div');
    this._axisContainer.className = 'axis-container';
    canvasContainer.appendChild(this._axisContainer);

    this._initWebGL(vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource);
  }

  /**
   * Factory function to create a CanvasRenderer with shader loading
   * @param {HTMLCanvasElement} canvasContainer - The container for the canvas element
   * @returns {Promise<CanvasRenderer>} - Promise that resolves to initialized renderer
   */
  static async create(canvasContainer) {
    // Load shaders from files
    const [vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource] = await Promise.all([
      fetch('./shaders/vertex.glsl').then(r => r.text()),
      fetch('./shaders/compute_fragment.glsl').then(r => r.text()),
      fetch('./shaders/render_fragment.glsl').then(r => r.text())
    ]);

    return new CanvasRenderer(
      canvasContainer,
      vertexShaderSource,
      computeFragmentShaderSource,
      renderFragmentShaderSource);
  }

  /**
   * Initialize WebGL shaders and buffers
   */
  _initWebGL(vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource) {
    const gl = this._gl;

    // Create and compile shaders
    const vertexShader = this._createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const computeFragmentShader = this._createShader(gl.FRAGMENT_SHADER, computeFragmentShaderSource);
    const renderFragmentShader = this._createShader(gl.FRAGMENT_SHADER, renderFragmentShaderSource);

    // Create and configure compute program
    const computeProgram = this._createProgram(vertexShader, computeFragmentShader);
    this._compute = {
      program: computeProgram,
      positionLocation: gl.getAttribLocation(computeProgram, 'a_position'),
      texCoordLocation: gl.getAttribLocation(computeProgram, 'a_texCoord'),
      fixedValueLocation: gl.getUniformLocation(computeProgram, 'u_fixedValue'),
      axisIndexLocation: gl.getUniformLocation(computeProgram, 'u_axisIndex'),
      colorSpaceIndexLocation: gl.getUniformLocation(computeProgram, 'u_colorSpaceIndex'),
      paletteColorsLocation: gl.getUniformLocation(computeProgram, 'u_paletteColors'),
      paletteCountLocation: gl.getUniformLocation(computeProgram, 'u_paletteCount'),
    };

    // Create and configure render program
    const renderProgram = this._createProgram(vertexShader, renderFragmentShader);
    this._render = {
      program: renderProgram,
      positionLocation: gl.getAttribLocation(renderProgram, 'a_position'),
      colorTextureLocation: gl.getUniformLocation(renderProgram, 'u_colorTexture'),
      showBoundariesLocation: gl.getUniformLocation(renderProgram, 'u_showBoundaries'),
      highlightPaletteIndexLocation: gl.getUniformLocation(renderProgram, 'u_highlightPaletteIndex'),
    };

    // Create framebuffer, texture, and vertex buffer
    this._createResources();
    gl.viewport(0, 0, this._width, this._height);
  }

  /**
   * Create framebuffer, texture, and vertex buffer
   */
  _createResources() {
    const gl = this._gl;

    // Create texture for framebuffer
    this._colorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._colorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._width, this._height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffer
    this._framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._colorTexture, 0);

    // Check framebuffer completeness
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete');
    }

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Create vertex buffer for full screen quad
    const quadData = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,  // bottom-left
      1.0, -1.0, 1.0, 0.0,  // bottom-right
      -1.0, 1.0, 0.0, 1.0,  // top-left
      1.0, 1.0, 1.0, 1.0,  // top-right
    ]);

    this._quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
  }

  /**
   * Create and compile a shader
   */
  _createShader(type, source) {
    const shader = this._gl.createShader(type);
    this._gl.shaderSource(shader, source);
    this._gl.compileShader(shader);

    if (!this._gl.getShaderParameter(shader, this._gl.COMPILE_STATUS)) {
      console.error('Error compiling shader:', this._gl.getShaderInfoLog(shader));
      this._gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Create and link shader program
   */
  _createProgram(vertexShader, fragmentShader) {
    const program = this._gl.createProgram();
    this._gl.attachShader(program, vertexShader);
    this._gl.attachShader(program, fragmentShader);
    this._gl.linkProgram(program);

    if (!this._gl.getProgramParameter(program, this._gl.LINK_STATUS)) {
      console.error('Error linking program:', this._gl.getProgramInfoLog(program));
      this._gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  /**
   * Set up vertex attributes for a specific program
   * @param {number} positionLocation - Position attribute location
   * @param {number|null} texCoordLocation - Texture coordinate attribute location
   */
  _setupVertexAttributes(positionLocation, texCoordLocation = null) {
    const gl = this._gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);

    if (texCoordLocation !== null) {
      gl.enableVertexAttribArray(texCoordLocation);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
    }
  }

  /**
   * Render a color space view with palette colors
   * @param {ColorSpaceView} colorSpaceView - Immutable color space view
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (null for no highlight)
   */
  renderColorSpace(colorSpaceView, paletteColors = [], highlightPaletteIndex = null) {
    // Store palette colors for consistency with indices
    this._paletteColors = [...paletteColors];

    // Compute phase: Render color space computation with closest palette index to framebuffer
    this._computePhase(colorSpaceView, paletteColors);

    // Render phase: Render framebuffer texture to canvas
    this._renderPhase(colorSpaceView.showBoundaries, highlightPaletteIndex);

    // Update axis labels for the current color space view
    this._updateAxisLabels(colorSpaceView);
  }

  /**
   * Compute phase: Render color space computation to framebuffer
   * @param {ColorSpaceView} colorSpaceView - Immutable color space view
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   */
  _computePhase(colorSpaceView, paletteColors) {
    const gl = this._gl;

    // Bind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.viewport(0, 0, this._width, this._height);

    // Use compute program
    gl.useProgram(this._compute.program);
    this._setupVertexAttributes(this._compute.positionLocation, this._compute.texCoordLocation);

    // Set uniforms
    gl.uniform1i(this._compute.axisIndexLocation, colorSpaceView.colorSpace.getAxisIndex(colorSpaceView.currentAxis));
    gl.uniform1f(this._compute.fixedValueLocation, colorSpaceView.currentValue / colorSpaceView.currentAxis.max);
    gl.uniform1i(this._compute.colorSpaceIndexLocation, getAllColorSpaces().indexOf(colorSpaceView.colorSpace));

    // Set palette colors uniforms
    const maxPaletteColors = 200; // Allow up to 200 palette colors
    const actualCount = Math.min(paletteColors.length, maxPaletteColors);
    gl.uniform1i(this._compute.paletteCountLocation, actualCount);

    // Convert palette colors to flat array of RGB values
    const paletteData = new Float32Array(maxPaletteColors * 3);
    for (let i = 0; i < actualCount; i++) {
      const paletteColor = paletteColors[i];
      const [r, g, b] = paletteColor.rgbColor;
      paletteData[i * 3] = r;
      paletteData[i * 3 + 1] = g;
      paletteData[i * 3 + 2] = b;
    }
    gl.uniform3fv(this._compute.paletteColorsLocation, paletteData);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Render phase: Render framebuffer texture to canvas
   * @param {boolean} showBoundaries - Whether to show region boundaries
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (null for no highlight)
   */
  _renderPhase(showBoundaries = true, highlightPaletteIndex = null) {
    const gl = this._gl;

    // Bind default framebuffer (canvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this._width, this._height);

    // Use render program
    gl.useProgram(this._render.program);
    this._setupVertexAttributes(this._render.positionLocation);

    // Bind and set the compute texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._colorTexture);
    gl.uniform1i(this._render.colorTextureLocation, 0);

    // Set boundaries visibility uniform
    gl.uniform1i(this._render.showBoundariesLocation, showBoundaries ? 1 : 0);

    // Set highlight palette index uniform (convert null to -1 for shader)
    gl.uniform1i(this._render.highlightPaletteIndexLocation, highlightPaletteIndex ?? -1);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Update axis labels and tick marks for the current color space view
   * @param {ColorSpaceView} colorSpaceView - Current color space view
   */
  _updateAxisLabels(colorSpaceView) {
    // Clear existing labels by emptying the axis container
    clearElement(this._axisContainer);

    const colorSpace = colorSpaceView.colorSpace;
    const axes = colorSpace.getAllAxes();
    const currentAxisIndex = colorSpace.getAxisIndex(colorSpaceView.currentAxis);

    // Get the two variable axes (non-fixed)
    const variableAxes = axes.filter((_, index) => index !== currentAxisIndex);

    if (variableAxes.length !== 2) return; // Should always be 2 for a 2D canvas

    // X-axis (bottom) - first variable axis
    this._createAxisLabelAndTicks(variableAxes[0], 'x-axis');

    // Y-axis (left) - second variable axis
    this._createAxisLabelAndTicks(variableAxes[1], 'y-axis');
  }

  /**
   * Create axis label and ticks
   * @param {Axis} axis
   * @param {string} className - CSS class ('x-axis' or 'y-axis')
   */
  _createAxisLabelAndTicks(axis, className) {
    const label = createElement('div', axis.name);
    label.className = `axis-label ${className}`;
    this._axisContainer.appendChild(label);

    // Add tick marks at intervals of 0.2 from 0.0 to 1.0
    const numIntervals = 5;
    for (let i = 0; i <= numIntervals; i++) {
      this._axisContainer.appendChild(
        this._createTick(i / numIntervals, axis, className));
    }
  }

  /**
   * Creates an individual tick mark element for an axis and appends it to the axis container.
   *
   * @private
   * @param {string} scaledPosition - Position along the axis (0.0 to 1.0)
   * @param {Axis} axis - The axis object containing min, max, and unit properties.
   * @param {string} axisClass - The CSS class for the tick mark ('x-axis' or 'y-axis').
   * @returns {HTMLElement} The created tick mark element.
   */
  _createTick(scaledPosition, axis, axisClass) {
    const value = Math.round(scaledPosition * axis.max);
    const tick = createElement('div', `${value}${axis.unit}`);
    tick.className = `tick-mark ${axisClass}`;

    if (axisClass === 'x-axis') {
      tick.style.left = `${Math.round(scaledPosition * this._width)}px`;
    } else {
      tick.style.top = `${Math.round((1 - scaledPosition) * this._height)}px`;
    }
    return tick;
  }

  /**
   * Get color at canvas coordinates by reading from the framebuffer
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Array} Tuple [RgbColor, closestColor] where RgbColor is normalized (0-1) and closestColor is a NamedColor object or null
   */
  getColorAt(x, y) {
    const gl = this._gl;

    // Clamp coordinates to canvas bounds
    x = Math.max(0, Math.min(x, this._width - 1));
    y = Math.max(0, Math.min(y, this._height - 1));

    // WebGL coordinates are flipped vertically
    const glY = this._height - 1 - y;

    // Bind framebuffer to read from it
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);

    // Read pixel data from framebuffer
    const pixels = new Uint8Array(4);
    gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Look up the closest palette color using the index from alpha channel
    const paletteIndex = pixels[3];
    const closestColor = (paletteIndex < this._paletteColors.length)
      ? this._paletteColors[paletteIndex]
      : null;

    // Convert pixels to normalized RgbColor
    const rgbColor = new RgbColor(
      pixels[0] / 255,
      pixels[1] / 255,
      pixels[2] / 255
    );

    return [
      rgbColor, // RgbColor instance with normalized coordinates
      closestColor // Actual NamedColor object or null
    ];
  }
}
