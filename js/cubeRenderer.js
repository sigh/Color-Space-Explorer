import { getAllColorSpaces, RgbColor, getAllDistanceMetrics } from "./colorSpace.js";
import { MAX_PALETTE_COLORS } from "./colorPalette.js";

// Import gl-matrix for efficient matrix operations
import '../lib/gl-matrix-min.js';
const { mat4 } = glMatrix;

const OUTSIDE_COLOR_SPACE = 255;

/**
 * WebGL2 3D Cube renderer for color spaces
 */
export class CubeRenderer {
  constructor(canvasContainer) {
    // Find the canvas element within the container
    this.canvas = canvasContainer.querySelector('canvas');
    if (!this.canvas) {
      throw new Error('No canvas element found in container');
    }

    this.gl = null;
    this._vertexBuffer = null;
    this._indexBuffer = null;
    this._framebuffer = null;
    this._framebufferTexture = null;
    this._depthBuffer = null;
    this._rotationMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._projectionMatrix = mat4.create();
    this._currentColorSpaceView = null;
    this._currentPaletteColors = null;
    this._currentHighlightPaletteIndex = null;

    this._setupWebGL();
    this._setupCamera();
    this._setupMouseControls();
  }

  /**
   * Setup WebGL context and canvas dimensions
   */
  _setupWebGL() {
    // Get WebGL2 context
    this._gl = this.canvas.getContext('webgl2');
    if (!this._gl) {
      throw new Error('WebGL2 not supported');
    }

    // Set canvas dimensions
    this._width = this.canvas.clientWidth;
    this._height = this.canvas.clientHeight;
    this.canvas.width = this._width;
    this.canvas.height = this._height;
  }

  /**
   * Setup camera matrices
   */
  _setupCamera() {
    // Set up view matrix (camera looking at origin)
    mat4.lookAt(this._viewMatrix, [0, 0, 2.5], [0, 0, 0], [0, 1, 0]);

    // Set up projection matrix
    mat4.perspective(this._projectionMatrix, Math.PI / 3, this._width / this._height, 0.1, 100.0);
  }

  /**
   * Factory function to create a CubeRenderer with shader loading
   * @param {HTMLElement} canvasContainer - The container element that contains the canvas
   * @returns {Promise<CubeRenderer>} - Promise that resolves to initialized renderer
   */
  static async create(canvasContainer) {
    // Load shaders from files - reuse render shaders from CanvasRenderer
    const [cubeVertexShaderSource, cubeComputeFragmentShaderSource, vertexShaderSource, renderFragmentShaderSource] = await Promise.all([
      fetch('./shaders/cube_vertex.glsl').then(r => r.text()),
      fetch('./shaders/cube_compute_fragment.glsl').then(r => r.text()),
      fetch('./shaders/vertex.glsl').then(r => r.text()),
      fetch('./shaders/render_fragment.glsl').then(r => r.text())
    ]);

    // Create renderer instance
    const renderer = new CubeRenderer(canvasContainer);

    // Initialize WebGL with shaders
    renderer._initWebGL(cubeVertexShaderSource, cubeComputeFragmentShaderSource, vertexShaderSource, renderFragmentShaderSource);

    return renderer;
  }

  /**
   * Initialize WebGL shaders and buffers
   */
  _initWebGL(cubeVertexShaderSource, cubeComputeFragmentShaderSource, vertexShaderSource, renderFragmentShaderSource) {
    const gl = this._gl;

    // Enable depth testing for 3D
    gl.enable(gl.DEPTH_TEST);

    // Create compute program for color space calculations (3D cube rendering)
    const cubeVertexShader = this._createShader(gl.VERTEX_SHADER, cubeVertexShaderSource);
    const computeFragmentShader = this._createShader(gl.FRAGMENT_SHADER, cubeComputeFragmentShaderSource);

    const computeProgram = this._createProgram(cubeVertexShader, computeFragmentShader);
    this._compute = {
      program: computeProgram,
      positionLocation: gl.getAttribLocation(computeProgram, 'a_position'),
      colorCoordLocation: gl.getAttribLocation(computeProgram, 'a_colorCoord'),
      modelViewProjectionLocation: gl.getUniformLocation(computeProgram, 'u_modelViewProjection'),
      colorSpaceIndexLocation: gl.getUniformLocation(computeProgram, 'u_colorSpaceIndex'),
      paletteColorsLocation: gl.getUniformLocation(computeProgram, 'u_paletteColors'),
      paletteCountLocation: gl.getUniformLocation(computeProgram, 'u_paletteCount'),
      distanceMetricLocation: gl.getUniformLocation(computeProgram, 'u_distanceMetric'),
      distanceThresholdLocation: gl.getUniformLocation(computeProgram, 'u_distanceThreshold'),
    };

    // Create render program for displaying framebuffer texture (reuse CanvasRenderer approach)
    const vertexShader = this._createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const renderFragmentShader = this._createShader(gl.FRAGMENT_SHADER, renderFragmentShaderSource);

    const renderProgram = this._createProgram(vertexShader, renderFragmentShader);
    this._render = {
      program: renderProgram,
      positionLocation: gl.getAttribLocation(renderProgram, 'a_position'),
      colorTextureLocation: gl.getUniformLocation(renderProgram, 'u_colorTexture'),
      showBoundariesLocation: gl.getUniformLocation(renderProgram, 'u_showBoundaries'),
      highlightPaletteIndexLocation: gl.getUniformLocation(renderProgram, 'u_highlightPaletteIndex'),
    };

    // Create cube geometry
    this._createCubeGeometry();

    // Create framebuffer resources for color lookup
    this._createFramebufferResources();

    gl.viewport(0, 0, this._width, this._height);
  }

  /**
   * Create cube geometry with color coordinates programmatically
   */
  _createCubeGeometry() {
    const gl = this._gl;

    // Generate cube vertices and indices programmatically
    const { vertices, indices } = this._generateCubeGeometry();

    // Create buffers
    this._vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this._indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    this._indexCount = indices.length;
  }

  /**
   * Create framebuffer resources for color lookup
   */
  _createFramebufferResources() {
    const gl = this._gl;

    // Create texture for framebuffer
    this._colorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._colorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._width, this._height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create depth buffer for proper 3D rendering
    this._depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this._depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this._width, this._height);

    // Create framebuffer
    this._framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._colorTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._depthBuffer);

    // Check framebuffer completeness
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer not complete');
    }

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Create vertex buffer for full screen quad (for compute pass)
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
   * Set up vertex attributes for a specific program
   * @param {number} positionLocation - Position attribute location
   * @param {number|null} texCoordLocation - Texture coordinate attribute location (optional)
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
   * Generate cube geometry data programmatically
   * @returns {Object} Object with vertices and indices arrays
   */
  _generateCubeGeometry() {
    const size = 1.2; // Cube size for better visibility
    const half = size / 2;

    // 8 corners of a cube with their RGB color coordinates
    // Corners are now ordered by bit pattern: 000, 001, 010, 011, 100, 101, 110, 111
    const corners = [];
    for (let i = 0; i < 8; i++) {
      const [r, g, b] = [i & 1, (i & 2) >> 1, (i & 4) >> 2];
      const x = r ? half : -half;
      const y = g ? half : -half;
      const z = b ? half : -half;

      corners.push([x, y, z, r, g, b]);
    }

    // Generate faces programmatically - each face shares one coordinate
    const vertices = [];
    const indices = [];

    // Generate 6 faces (3 axes × 2 directions each)
    for (let axis = 0; axis < 3; axis++) {
      for (let direction = 0; direction < 2; direction++) {
        const baseIndex = vertices.length / 6;  // Each vertex has 6 components

        // Find the 4 corners that belong to this face
        const faceCorners = corners.filter((_, i) => {
          return ((i >> axis) & 1) === direction;
        });

        // Add vertices for this face
        vertices.push(...faceCorners.flat());

        // Add triangles for this face (quad split into 2 triangles)
        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex + 1, baseIndex + 2, baseIndex + 3
        );
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices)
    };
  }

  /**
   * Setup mouse controls for camera rotation
   */
  _setupMouseControls() {
    const element = this.canvas;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      e.stopPropagation();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY;

      // // Create incremental rotation matrices and apply them to current rotation
      const rotationSpeed = 0.01;
      const deltaRotation = mat4.create();

      // Apply world Y rotation
      mat4.fromYRotation(deltaRotation, deltaX * rotationSpeed);
      mat4.multiply(this._rotationMatrix, deltaRotation, this._rotationMatrix);

      // Apply world X rotation
      mat4.fromXRotation(deltaRotation, deltaY * rotationSpeed);
      mat4.multiply(this._rotationMatrix, deltaRotation, this._rotationMatrix);

      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // Re-render both framebuffer and canvas when rotating
      if (this._currentColorSpaceView && this._currentPaletteColors) {
        this._renderToFramebuffer(this._currentColorSpaceView, this._currentPaletteColors);
        this._renderToCanvas(this._currentHighlightPaletteIndex);
      }

      e.stopPropagation();
    };

    const onMouseUp = (e) => {
      isDragging = false;
      e.stopPropagation();
    };

    element.addEventListener('mousedown', onMouseDown);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mouseleave', onMouseUp);
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
   * Render the 3D color space cube
   * @param {ColorSpaceView} colorSpaceView - Immutable color space view
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (null for no highlight)
   */
  renderColorSpace(colorSpaceView, paletteColors = [], highlightPaletteIndex = null) {
    // Store palette colors for consistency with indices
    this._paletteColors = [...paletteColors];

    this._currentColorSpaceView = colorSpaceView;
    this._currentPaletteColors = paletteColors;
    this._currentHighlightPaletteIndex = highlightPaletteIndex;

    // First render: 3D cube to framebuffer for color lookup
    this._renderToFramebuffer(colorSpaceView, paletteColors);

    // Second render: display framebuffer texture to canvas
    this._renderToCanvas(highlightPaletteIndex);
  }

  /**
   * Render 3D cube to framebuffer for color lookup
   * @param {ColorSpaceView} colorSpaceView - Immutable color space view
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   */
  _renderToFramebuffer(colorSpaceView, paletteColors) {
    const gl = this._gl;

    // Bind framebuffer for rendering
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.viewport(0, 0, this._width, this._height);

    // Clear and setup
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Set alpha to 1.0 for valid pixels
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the compute program to render cube with color space computation
    gl.useProgram(this._compute.program);

    // Set up vertex attributes for 3D cube
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.enableVertexAttribArray(this._compute.positionLocation);
    gl.vertexAttribPointer(this._compute.positionLocation, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this._compute.colorCoordLocation);
    gl.vertexAttribPointer(this._compute.colorCoordLocation, 3, gl.FLOAT, false, 24, 12);

    // Create transformation matrix
    const mvpMatrix = mat4.create();
    mat4.perspective(mvpMatrix, Math.PI / 3, this._width / this._height, 0.1, 100.0);
    mat4.translate(mvpMatrix, mvpMatrix, [0, 0, -2.5]);
    mat4.multiply(mvpMatrix, mvpMatrix, this._rotationMatrix);

    // Set transformation matrix uniform
    gl.uniformMatrix4fv(this._compute.modelViewProjectionLocation, false, mvpMatrix);

    // Set color space uniforms
    gl.uniform1i(this._compute.colorSpaceIndexLocation, getAllColorSpaces().indexOf(colorSpaceView.colorSpace));

    // Set distance metric uniform
    gl.uniform1i(
      this._compute.distanceMetricLocation,
      getAllDistanceMetrics().indexOf(colorSpaceView.distanceMetric));

    // Set distance threshold uniform
    gl.uniform1f(this._compute.distanceThresholdLocation, colorSpaceView.distanceThreshold);

    // Set palette colors uniforms
    const actualCount = Math.min(paletteColors.length, MAX_PALETTE_COLORS);
    gl.uniform1i(this._compute.paletteCountLocation, actualCount);

    // Convert palette colors to flat array of RGB values
    const paletteData = new Float32Array(MAX_PALETTE_COLORS * 3);
    for (let i = 0; i < actualCount; i++) {
      const paletteColor = paletteColors[i];
      const [r, g, b] = paletteColor.rgbColor;
      paletteData[i * 3] = r;
      paletteData[i * 3 + 1] = g;
      paletteData[i * 3 + 2] = b;
    }
    gl.uniform3fv(this._compute.paletteColorsLocation, paletteData);

    // Draw the cube to framebuffer
    gl.drawElements(gl.TRIANGLES, this._indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Render framebuffer texture to canvas for display
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (null for no highlight)
   */
  _renderToCanvas(highlightPaletteIndex = null) {
    const gl = this._gl;

    // Bind default framebuffer (canvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this._width, this._height);

    // Clear and setup
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use render program to display framebuffer texture
    gl.useProgram(this._render.program);
    this._setupVertexAttributes(this._render.positionLocation);

    // Bind and set the compute texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._colorTexture);
    gl.uniform1i(this._render.colorTextureLocation, 0);

    // Set boundaries visibility uniform (always show boundaries for 3D)
    gl.uniform1i(this._render.showBoundariesLocation, 1);

    // Set highlight palette index uniform (convert null to -1 for shader)
    gl.uniform1i(this._render.highlightPaletteIndexLocation, highlightPaletteIndex ?? -1);

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Get color at canvas coordinates by reading from the framebuffer
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Array} Tuple [RgbColor, NamedColor] where RgbColor is
   *    normalized (0-1) and closestColor is a NamedColor object or null.
   *    Both will be null for invalid coordinates.
   */
  getColorAt(x, y) {
    // Coordinates outside the canvas bounds
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return [null, null];
    }

    const gl = this._gl;

    // WebGL coordinates are flipped vertically
    const glY = this._height - 1 - y;

    // Bind framebuffer to read from it
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);

    // Read pixel data from framebuffer
    const pixels = new Uint8Array(4);
    gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Check if we are outside the color space
    const paletteIndex = pixels[3];
    if (paletteIndex === OUTSIDE_COLOR_SPACE) {
      return [null, null];
    }

    // Look up the closest palette color using the index from alpha channel
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

  /**
   * Wait for GPU rendering to complete
   * @returns {Promise<void>} Promise that resolves when all GPU commands are complete
   */
  async waitForCurrentRender() {
    const gl = this._gl;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    return new Promise(resolve => {
      const checkSync = () => {
        const status = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
          gl.deleteSync(sync);
          resolve();
        } else {
          // Check again on next frame if not ready
          requestAnimationFrame(checkSync);
        }
      };
      checkSync();
    });
  }
}
