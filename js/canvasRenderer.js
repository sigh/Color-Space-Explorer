import { getAllColorSpaces } from "./colorSpace.js";

/**
 * WebGL Canvas renderer for color spaces with framebuffer rendering
 */
export class CanvasRenderer {
  constructor(canvas, vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource) {
    this.canvas = canvas;
    this._gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

    if (!this._gl) {
      throw new Error('WebGL not supported');
    }

    this._width = canvas.width;
    this._height = canvas.height;
    this._paletteColors = []; // The palette colors used for indexing.

    this._initWebGL(vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource);
  }

  /**
   * Factory function to create a CanvasRenderer with shader loading
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @returns {Promise<CanvasRenderer>} - Promise that resolves to initialized renderer
   */
  static async create(canvas) {
    // Load shaders from files
    const [vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource] = await Promise.all([
      fetch('./shaders/vertex.glsl').then(r => r.text()),
      fetch('./shaders/compute_fragment.glsl').then(r => r.text()),
      fetch('./shaders/render_fragment.glsl').then(r => r.text())
    ]);

    return new CanvasRenderer(canvas, vertexShaderSource, computeFragmentShaderSource, renderFragmentShaderSource);
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
      texCoordLocation: gl.getAttribLocation(renderProgram, 'a_texCoord'),
      colorTextureLocation: gl.getUniformLocation(renderProgram, 'u_colorTexture'),
      textureSizeLocation: gl.getUniformLocation(renderProgram, 'u_textureSize'),
      showBoundariesLocation: gl.getUniformLocation(renderProgram, 'u_showBoundaries'),
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
   * @param {number} texCoordLocation - Texture coordinate attribute location
   */
  _setupVertexAttributes(positionLocation, texCoordLocation) {
    const gl = this._gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
  }

  /**
   * Render a color space view with palette colors
   * @param {ColorSpaceView} colorSpaceView - Immutable color space view
   * @param {Array<PaletteColor>} paletteColors - Array of palette colors to find closest matches for
   */
  renderColorSpace(colorSpaceView, paletteColors = []) {
    // Store palette colors for consistency with indices
    this._paletteColors = [...paletteColors];

    // Compute phase: Render color space computation with closest palette index to framebuffer
    this._computePhase(colorSpaceView, paletteColors);

    // Render phase: Render framebuffer texture to canvas
    this._renderPhase(colorSpaceView.showBoundaries);
  }

  /**
   * Compute phase: Render color space computation to framebuffer
   * @param {ColorSpaceView} colorSpaceView - Immutable color space view
   * @param {Array<PaletteColor>} paletteColors - Array of palette colors to find closest matches for
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
      const color = paletteColors[i];
      paletteData[i * 3] = color.rgb.r;
      paletteData[i * 3 + 1] = color.rgb.g;
      paletteData[i * 3 + 2] = color.rgb.b;
    }
    gl.uniform3fv(this._compute.paletteColorsLocation, paletteData);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Render phase: Render framebuffer texture to canvas
   * @param {boolean} showBoundaries - Whether to show region boundaries
   */
  _renderPhase(showBoundaries = true) {
    const gl = this._gl;

    // Bind default framebuffer (canvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this._width, this._height);

    // Use render program
    gl.useProgram(this._render.program);
    this._setupVertexAttributes(this._render.positionLocation, this._render.texCoordLocation);

    // Bind and set the compute texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._colorTexture);
    gl.uniform1i(this._render.colorTextureLocation, 0);

    // Set texture size uniform
    gl.uniform2f(this._render.textureSizeLocation, this._width, this._height);

    // Set boundaries visibility uniform
    gl.uniform1i(this._render.showBoundariesLocation, showBoundaries ? 1 : 0);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Get color at canvas coordinates by reading from the framebuffer
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Array} Tuple [{r, g, b}, closestColor] where RGB values are 0-255 and closestColor is a PaletteColor object or null
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

    return [
      { r: pixels[0], g: pixels[1], b: pixels[2] }, // RGB color object
      closestColor // Actual PaletteColor object or null
    ];
  }
}
