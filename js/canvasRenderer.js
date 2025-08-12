import { getAllColorSpaces, RgbColor, getAllDistanceMetrics } from "./colorSpace.js";
import { clearElement, createElement } from "./utils.js";
import { MAX_PALETTE_COLORS } from "./colorPalette.js";

// Import gl-matrix for efficient matrix operations
import '../lib/gl-matrix-min.js';
const { mat4 } = glMatrix;

const OUTSIDE_COLOR_SPACE = 255;

// Camera and projection constants
const CAMERA_FOV = Math.PI / 3; // 60 degrees
const CAMERA_DISTANCE = 2;

/**
 * Calculate the size needed to fill the viewport at a given camera distance
 * @param {number} distance - Camera distance
 * @param {number} fov - Field of view in radians (optional, defaults to CAMERA_FOV)
 * @returns {number} Size that fills the viewport
 */
function calculateViewportSize(distance, fov = CAMERA_FOV) {
  // For perspective projection: tan(fov/2) * distance * 2
  return Math.tan(fov / 2) * distance * 2;
}

/**
* WebGL2 Canvas renderer for color spaces with framebuffer rendering
*/
export class CanvasRenderer {
  constructor(canvasContainer, computeVertexShaderSource, computeFragmentShaderSource, vertexShaderSource, renderFragmentShaderSource) {
    const canvas = canvasContainer.querySelector('canvas');
    this._gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });

    if (!this._gl) {
      throw new Error('WebGL2 not supported');
    }

    this._width = canvas.width;
    this._height = canvas.height;
    this._paletteColors = []; // The palette colors used for indexing.

    // Initialize unified geometry object
    this._geometry = {
      vertexBuffer: null,
      indexBuffer: null,
      indexCount: 0
    };

    // Initialize transformation matrix
    this._mvpMatrix = this._createTransformationMatrix();

    // Create axis container for labels and tick marks
    this._axisContainer = document.createElement('div');
    this._axisContainer.className = 'axis-container';
    canvasContainer.appendChild(this._axisContainer);

    this._initWebGL(computeVertexShaderSource, computeFragmentShaderSource, vertexShaderSource, renderFragmentShaderSource);
  }

  /**
   * Create the base transformation matrix with projection and camera translation
   * @returns {mat4} The transformation matrix
   */
  _createTransformationMatrix() {
    const mvpMatrix = mat4.create();
    // Create base transformation matrix with projection and camera position
    mat4.perspective(mvpMatrix, CAMERA_FOV, this._width / this._height, 0.1, 100.0);
    mat4.translate(mvpMatrix, mvpMatrix, [0, 0, -CAMERA_DISTANCE]);
    return mvpMatrix;
  }

  /**
   * Factory function to create a CanvasRenderer with shader loading
   * @param {HTMLCanvasElement} canvasContainer - The container for the canvas element
   * @returns {Promise<CanvasRenderer>} - Promise that resolves to initialized renderer
   */
  static async create(canvasContainer) {
    // Load shaders from files - using original compute_fragment.glsl
    const [computeVertexShaderSource, computeFragmentShaderSource, renderVertexShaderSource, renderFragmentShaderSource] = await Promise.all([
      fetch('./shaders/compute_vertex.glsl').then(r => r.text()),
      fetch('./shaders/compute_fragment.glsl').then(r => r.text()),
      fetch('./shaders/render_vertex.glsl').then(r => r.text()),
      fetch('./shaders/render_fragment.glsl').then(r => r.text())
    ]);

    return new CanvasRenderer(
      canvasContainer,
      computeVertexShaderSource,
      computeFragmentShaderSource,
      renderVertexShaderSource,
      renderFragmentShaderSource);
  }

  /**
   * Initialize WebGL shaders and buffers
   */
  _initWebGL(computeVertexShaderSource, computeFragmentShaderSource, renderVertexShaderSource, renderFragmentShaderSource) {
    const gl = this._gl;

    // Enable depth testing for 3D
    gl.enable(gl.DEPTH_TEST);

    // Create and compile shaders
    const computeVertexShader = this._createShader(gl.VERTEX_SHADER, computeVertexShaderSource);
    const computeFragmentShader = this._createShader(gl.FRAGMENT_SHADER, computeFragmentShaderSource);
    const renderVertexShader = this._createShader(gl.VERTEX_SHADER, renderVertexShaderSource);
    const renderFragmentShader = this._createShader(gl.FRAGMENT_SHADER, renderFragmentShaderSource);

    // Create and configure compute program (3D face rendering with original compute_fragment.glsl)
    const computeProgram = this._createProgram(computeVertexShader, computeFragmentShader);
    this._compute = {
      program: computeProgram,
      positionLocation: gl.getAttribLocation(computeProgram, 'a_position'),
      colorCoordLocation: gl.getAttribLocation(computeProgram, 'a_colorCoord'),
      modelViewProjectionLocation: gl.getUniformLocation(computeProgram, 'u_modelViewProjection'),
      variableAxesLocation: gl.getUniformLocation(computeProgram, 'u_variableAxes'),
      polarAngleAxisLocation: gl.getUniformLocation(computeProgram, 'u_polarAngleAxis'),
      colorSpaceIndexLocation: gl.getUniformLocation(computeProgram, 'u_colorSpaceIndex'),
      paletteColorsLocation: gl.getUniformLocation(computeProgram, 'u_paletteColors'),
      paletteCountLocation: gl.getUniformLocation(computeProgram, 'u_paletteCount'),
      distanceMetricLocation: gl.getUniformLocation(computeProgram, 'u_distanceMetric'),
      distanceThresholdLocation: gl.getUniformLocation(computeProgram, 'u_distanceThreshold'),
    };

    // Create and configure render program
    const renderProgram = this._createProgram(renderVertexShader, renderFragmentShader);
    this._render = {
      program: renderProgram,
      positionLocation: gl.getAttribLocation(renderProgram, 'a_position'),
      texCoordLocation: gl.getAttribLocation(renderProgram, 'a_texCoord'),
      colorTextureLocation: gl.getUniformLocation(renderProgram, 'u_colorTexture'),
      showBoundariesLocation: gl.getUniformLocation(renderProgram, 'u_showBoundaries'),
      highlightPaletteIndexLocation: gl.getUniformLocation(renderProgram, 'u_highlightPaletteIndex'),
    };

    // Create framebuffer, texture, and vertex buffer
    this._createResources();
    gl.viewport(0, 0, this._width, this._height);
  }

  /**
   * Create framebuffer, texture, vertex buffer, and face geometry
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

    // Create vertex buffer for full screen quad (for display pass)
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
   * Create geometry buffers from vertices and indices data
   * @param {Float32Array} vertices - Vertex data
   * @param {Uint16Array} indices - Index data
   */
  _createGeometry(vertices, indices) {
    const gl = this._gl;

    // Create vertex buffer
    this._geometry.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._geometry.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Create index buffer
    this._geometry.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._geometry.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    this._geometry.indexCount = indices.length;
  }

  /**
   * Generate 3D cube geometry data programmatically (same logic as CubeRenderer)
   * @returns {Object} Object with vertices and indices arrays
   */
  _generate3DCubeGeometry() {
    const size = 1.1; // Cube size for better visibility

    // Generate all 8 corners of the cube with RGB color coordinates
    // Color axis order [0,1,2] means x->R, y->G, z->B
    const corners = CubeGeometryHelper.generateCubeCorners(size, [0, 1, 2]);

    // Generate faces programmatically - each face shares one coordinate
    const vertices = [];
    const indices = [];

    // Generate 6 faces (3 axes × 2 directions each)
    for (let axis = 0; axis < 3; axis++) {
      for (let direction = 0; direction < 2; direction++) {
        const baseIndex = vertices.length / 6;  // Each vertex has 6 components

        // Find the 4 corners that belong to this face
        const faceCorners = CubeGeometryHelper.filterCornersByFace(
          corners, axis, direction);

        // Add vertices for this face
        vertices.push(...faceCorners.flat());

        // Add triangles for this face (quad split into 2 triangles)
        indices.push(...CubeGeometryHelper.generateFaceIndexes(baseIndex));
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices)
    };
  }

  /**
   * Generate face geometry data for a specific color space configuration
   * @param {ColorSpaceConfig} colorSpaceConfig - The color space configuration
   * @returns {Object} Object with vertices and indices arrays
   */
  _generateFaceGeometry(colorSpaceConfig) {
    // Calculate size to fill the viewport at the 2D camera distance
    const size = calculateViewportSize(CAMERA_DISTANCE);

    // Generate face based on the color space configuration using cube renderer techniques
    const colorSpace = colorSpaceConfig.colorSpace;
    const currentAxisIndex = colorSpace.getAxisIndex(colorSpaceConfig.currentAxis);
    const fixedValue = colorSpaceConfig.currentValue / colorSpaceConfig.currentAxis.max; // Normalized to [0,1]

    // Create color axis mapping where:
    // - X position maps to first variable axis
    // - Y position maps to second variable axis
    // - Z position maps to fixed axis (will be set to fixedValue)
    const colorAxisOrder = [0, 1, 2]
      .filter(axis => axis !== currentAxisIndex);
    colorAxisOrder.push(currentAxisIndex);

    // Generate cube corners with the mapped axis order
    const allCorners = CubeGeometryHelper.generateCubeCorners(size, colorAxisOrder);

    // Filter to get the 4 corners with the same z value.
    const faceCorners = CubeGeometryHelper.filterCornersByFace(allCorners, 2, 1);

    // Adjust the color coordinates for the fixed axis to the exact value
    const adjustedCorners = faceCorners.map(corner => {
      const adjustedCorner = [...corner];
      // Set exact fixed value in original color space
      adjustedCorner[3 + currentAxisIndex] = fixedValue;
      // Position Z to 0 for 2D face
      adjustedCorner[2] = 0.0;
      return adjustedCorner;
    });

    // Create vertices array from corners and simple indices for single face
    const vertices = new Float32Array(adjustedCorners.flat());
    const indices = new Uint16Array(CubeGeometryHelper.generateFaceIndexes(0));

    return { vertices, indices };
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
   * Render a 3D face representing the color space
   * @param {ColorSpaceConfig} colorSpaceConfig
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (null for no highlight)
   */
  renderColorSpace(colorSpaceConfig, paletteColors = [], highlightPaletteIndex = null) {
    // Store palette colors for consistency with indices
    this._paletteColors = [...paletteColors];

    // Regenerate 2D face geometry
    const { vertices, indices } = this._generateFaceGeometry(colorSpaceConfig);
    this._createGeometry(vertices, indices);

    // First phase: Render 3D face to framebuffer for color computation
    this._renderToFramebuffer(colorSpaceConfig, paletteColors);

    // Second phase: Display framebuffer texture to canvas
    this._renderToCanvas(colorSpaceConfig.showBoundaries, highlightPaletteIndex);

    // Update axis labels for the current color space configuration (maintain 2D functionality)
    const polarAxis = colorSpaceConfig.usePolarCoordinates ?
      colorSpaceConfig.colorSpace.availablePolarAxis(colorSpaceConfig.currentAxis) : null;
    this._updateAxisLabels(colorSpaceConfig, polarAxis);
  }

  /**
   * Render a 3D color space cube with rotation (same functionality as CubeRenderer)
   * @param {ColorSpaceConfig} colorSpaceConfig
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (null for no highlight)
   * @param {Float32Array} rotationMatrix - 4x4 rotation matrix for the cube
   */
  render3DColorSpace(colorSpaceConfig, paletteColors = [], highlightPaletteIndex = null, rotationMatrix = null) {
    // Store palette colors for consistency with indices
    this._paletteColors = [...paletteColors];

    // Create 3D cube geometry
    const { vertices, indices } = this._generate3DCubeGeometry();
    this._createGeometry(vertices, indices);

    // First phase: Render 3D cube to framebuffer for color computation
    this._renderToFramebuffer(colorSpaceConfig, paletteColors, rotationMatrix);

    // Second phase: Display framebuffer texture to canvas
    this._renderToCanvas(colorSpaceConfig.showBoundaries, highlightPaletteIndex);
  }

  /**
   * Compute colors into the framebuffer
   * @param {ColorSpaceConfig} colorSpaceConfig
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   * @param {Float32Array} rotationMatrix - 4x4 rotation matrix for the cube (only used for 3D)
   */
  _renderToFramebuffer(colorSpaceConfig, paletteColors, rotationMatrix = null) {
    const gl = this._gl;

    // Bind framebuffer for rendering
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.viewport(0, 0, this._width, this._height);

    // Clear and setup
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Set alpha to 1.0 for valid pixels
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the compute program to render with color space computation
    gl.useProgram(this._compute.program);

    // Set up vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this._geometry.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._geometry.indexBuffer);

    gl.enableVertexAttribArray(this._compute.positionLocation);
    gl.vertexAttribPointer(this._compute.positionLocation, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this._compute.colorCoordLocation);
    gl.vertexAttribPointer(this._compute.colorCoordLocation, 3, gl.FLOAT, false, 24, 12);

    // Compute transformation matrix (apply rotation if provided)
    const finalMvpMatrix = rotationMatrix
      ? mat4.multiply(mat4.create(), this._mvpMatrix, rotationMatrix)
      : this._mvpMatrix;

    // Set transformation matrix uniform
    gl.uniformMatrix4fv(
      this._compute.modelViewProjectionLocation, false, finalMvpMatrix);

    // Set the polar axis uniform (if applicable)
    const colorSpace = colorSpaceConfig.colorSpace;
    const polarAxis = colorSpaceConfig.usePolarCoordinates && !rotationMatrix ?
      colorSpaceConfig.colorSpace.availablePolarAxis(colorSpaceConfig.currentAxis) : null;
    const polarAxisIndex = polarAxis ? colorSpace.getAxisIndex(polarAxis) : -1;
    gl.uniform1i(this._compute.polarAngleAxisLocation, polarAxisIndex);

    // Set variable axes (only relevant polar calculations)
    {
      const currentAxisIndex = colorSpace.getAxisIndex(colorSpaceConfig.currentAxis);

      // Calculate the two variable axes (the ones that aren't fixed)
      const variableAxes = [];
      for (let i = 0; i < 3; i++) {
        if (i !== currentAxisIndex) {
          variableAxes.push(i);
        }
      }
      gl.uniform2iv(this._compute.variableAxesLocation, variableAxes);
    }

    // Common uniforms for both modes
    gl.uniform1i(
      this._compute.colorSpaceIndexLocation,
      getAllColorSpaces().indexOf(colorSpaceConfig.colorSpace)
    );
    gl.uniform1i(
      this._compute.distanceMetricLocation,
      getAllDistanceMetrics().indexOf(colorSpaceConfig.distanceMetric)
    );
    gl.uniform1f(
      this._compute.distanceThresholdLocation,
      colorSpaceConfig.distanceThreshold);

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

    // Draw using unified geometry
    gl.drawElements(gl.TRIANGLES, this._geometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Render phase: Render framebuffer texture to canvas for display
   * @param {boolean} showBoundaries - Whether to show region boundaries
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (null for no highlight)
   */
  _renderToCanvas(showBoundaries = true, highlightPaletteIndex = null) {
    const gl = this._gl;

    // Bind default framebuffer (canvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this._width, this._height);

    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Disable depth testing for 2D display pass
    gl.disable(gl.DEPTH_TEST);

    // Use render program
    gl.useProgram(this._render.program);
    this._setupVertexAttributes(this._render.positionLocation, this._render.texCoordLocation);

    // Bind and set the compute texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._colorTexture);
    gl.uniform1i(this._render.colorTextureLocation, 0);

    // Set boundaries visibility uniform
    gl.uniform1i(this._render.showBoundariesLocation, showBoundaries ? 1 : 0);

    // Set highlight palette index uniform (convert null to -1 for shader)
    gl.uniform1i(this._render.highlightPaletteIndexLocation, highlightPaletteIndex ?? -1);

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Re-enable depth testing for subsequent 3D rendering
    gl.enable(gl.DEPTH_TEST);
  }

  /**
   * Update axis labels and tick marks for the current color space configuration
   * @param {ColorSpaceConfig} colorSpaceConfig - Current color space configuration
   * @param {Axis|null} polarAxis - Axis to use for polar coordinates, or null if not polar display
   */
  _updateAxisLabels(colorSpaceConfig, polarAxis) {
    // Clear existing labels by emptying the axis container
    clearElement(this._axisContainer);

    if (polarAxis) {
      this._addPolarAxisLabels(polarAxis, 'theta-axis');
      return;
    }

    // For regular cartesian coordinates, we need to figure out which axes to display.

    const colorSpace = colorSpaceConfig.colorSpace;
    const axes = colorSpace.getAllAxes();
    const currentAxisIndex = colorSpace.getAxisIndex(colorSpaceConfig.currentAxis);

    // Get the two variable axes (non-fixed)
    const variableAxes = axes.filter((_, index) => index !== currentAxisIndex);
    if (variableAxes.length !== 2) return; // Should always be 2 for a 2D canvas

    this._addCartesianAxisLabels(variableAxes[0], 'x-axis');
    this._addCartesianAxisLabels(variableAxes[1], 'y-axis');
  }

  /**
   * Wait for GPU rendering to complete
   * @returns {Promise<void>} Promise that resolves when all GPU commands are complete
   */
  waitForCurrentRender() {
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

  /**
   * Add polar axis labels and ticks
   * @param {Axis} polarAxis - The polar axis to label
   * @param {string} className - CSS class for the axis ('theta-axis')
   */
  _addPolarAxisLabels(polarAxis, className) {
    const numIntervals = 8;
    for (let i = 0; i < numIntervals; i++) {
      const angle = (i / numIntervals) * 2 * Math.PI; // Convert to radians

      const value = Math.round((i / numIntervals) * polarAxis.max);
      const tick = createElement('div', `${value}${polarAxis.unit}`);
      tick.className = `tick-mark ${className}`;
      if (i == 0) {
        tick.textContent += ` ${polarAxis.name}`;
        tick.classList.add('axis-title');
      }

      const x = 0.5 * (1 + Math.cos(angle) * 1.06);
      const y = 0.5 * (1 - Math.sin(angle) * 1.06);
      tick.style.left = `${Math.round(x * this._width)}px`;
      tick.style.top = `${Math.round(y * this._height)}px`;
      this._axisContainer.appendChild(tick);
    }
  }

  /**
   * Add axis title and ticks
   * @param {Axis} axis
   * @param {string} className - CSS class ('x-axis' or 'y-axis')
   */
  _addCartesianAxisLabels(axis, className) {
    const titleDiv = createElement('div', axis.name);
    titleDiv.className = `axis-title ${className}`;
    this._axisContainer.appendChild(titleDiv);

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
}

class CubeGeometryHelper {
  /**
   * Generate all 8 corners of a cube using bit patterns
   * @param {number} size - Size of the cube
   * @param {Array<number>} colorAxisOrder - Array of 3 indices mapping [x,y,z] positions to color coordinates [0,1,2]
   * @returns {Array} Array of 8 corners, each with [x, y, z, colorCoord0, colorCoord1, colorCoord2]
   */
  static generateCubeCorners(size, colorAxisOrder = [0, 1, 2]) {
    const half = size / 2;
    const corners = [];

    // Generate 8 corners using 3-bit patterns: 000, 001, 010, 011, 100, 101, 110, 111
    for (let i = 0; i < 8; i++) {
      const [xBit, yBit, zBit] = [i & 1, (i & 2) >> 1, (i & 4) >> 2];

      // Position coordinates
      const x = xBit ? half : -half;
      const y = yBit ? half : -half;
      const z = zBit ? half : -half;

      // Color coordinates based on axis order mapping
      const colorCoord = [0, 0, 0];
      colorCoord[colorAxisOrder[0]] = xBit;
      colorCoord[colorAxisOrder[1]] = yBit;
      colorCoord[colorAxisOrder[2]] = zBit;

      corners.push([x, y, z, ...colorCoord]);
    }
    return corners;
  }

  /**
   * Generate the indices for a single face of the cube
   * @param {number} baseIndex
   * @returns
   */
  static generateFaceIndexes(baseIndex) {
    // Each face is a quad made of 2 triangles
    return [
      baseIndex, baseIndex + 1, baseIndex + 2,
      baseIndex + 1, baseIndex + 2, baseIndex + 3
    ];
  }

  /**
   * Generate the 4 corners of a face based on the axis index and direction
   * @param {number} axisIndex - The index of the fixed axis (0, 1, or 2)
   * @param {number} direction - The direction of the face (0 or 1)
   * @returns {Array} Array of 4 corners for the specified face
   */
  static filterCornersByFace(corners, axisIndex, direction) {
    return corners.filter((_, i) => {
      // Check the bit corresponding to the axis index
      return ((i >> axisIndex) & 1) === direction;
    });
  }
}