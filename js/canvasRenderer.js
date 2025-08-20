import { getAllColorSpaces, RgbColor, getAllDistanceMetrics } from "./colorSpace.js";
import { clearElement, createElement } from "./utils.js";
import { MAX_PALETTE_COLORS } from "./colorPalette.js";
import { getAllHighlightModes, ColorSpaceConfig } from "./configController.js";
import {
  generateCubeSurface,
  generateCubeWireframe,
  generateCrossSections,
  generate2DFace,
  generateCylinderSurface,
  generateCylinderWireframe
} from "./shapeMakers.js";

// Import gl-matrix for efficient matrix operations
import '../lib/gl-matrix-min.js';
const { mat4 } = glMatrix;

const OUTSIDE_COLOR_SPACE = 255;

// Camera and projection constants
const CAMERA_FOV = Math.PI / 3; // 60 degrees
const CAMERA_DISTANCE = 2;

const CUBE_SIZE_3D = 1.1;

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
  constructor(canvasContainer, shaderSources) {
    const canvas = canvasContainer.querySelector('canvas');
    this._gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });

    if (!this._gl) {
      throw new Error('WebGL2 not supported');
    }

    this._width = canvas.width;
    this._height = canvas.height;
    this._paletteColors = []; // The palette colors used for indexing.

    // Initialize unified geometry object
    this._colorGeometry = {
      vertexBuffer: null,
      indexBuffer: null,
      indexCount: 0
    };

    // Initialize wireframe geometry object
    this._wireframeGeometry = {
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

    this._initWebGL(shaderSources);
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
   * Create a rotation matrix to orient a cube face toward the camera for 2D rendering
   * @param {ColorSpaceConfig} colorSpaceConfig - The color space configuration
   * @returns {mat4} Rotation matrix to orient the specified face toward the camera
   */
  _createFaceRotationMatrix(colorSpaceConfig) {
    const colorSpace = colorSpaceConfig.colorSpace;
    const currentAxisIndex = colorSpace.getAxisIndex(colorSpaceConfig.currentAxis);

    const rotationMatrix = mat4.create();

    // Based on which axis is fixed, rotate to face that axis toward the camera
    switch (currentAxisIndex) {
      case 0: // X-axis fixed. y points left, z points up.
        {
          mat4.fromZRotation(rotationMatrix, -Math.PI / 2);
          return mat4.rotateY(rotationMatrix, rotationMatrix, -Math.PI / 2);
        }

      case 1: // Y-axis fixed. x points left, x points up
        return mat4.fromXRotation(rotationMatrix, -Math.PI / 2);

      case 2: // Z-axis fixed - x points left, y points up
        return rotationMatrix;
    }
  }

  /**
   * Factory function to create a CanvasRenderer with shader loading
   * @param {HTMLCanvasElement} canvasContainer - The container for the canvas element
   * @returns {Promise<CanvasRenderer>} - Promise that resolves to initialized renderer
   */
  static async create(canvasContainer) {
    // Define shader file names
    const shaderFiles = [
      'compute_vertex.glsl',
      'compute_fragment.glsl',
      'render_vertex.glsl',
      'render_fragment.glsl',
      'wireframe_vertex.glsl',
      'wireframe_fragment.glsl'
    ];

    // Load all shaders and create a map from filename to source
    const shaderSources = new Map();
    const loadPromises = shaderFiles.map(async filename => {
      const source = await fetch(`./shaders/${filename}`).then(r => r.text());
      shaderSources.set(filename, source);
    });

    await Promise.all(loadPromises);

    return new CanvasRenderer(canvasContainer, shaderSources);
  }

  /**
   * Initialize WebGL shaders and buffers
   */
  _initWebGL(shaderSources) {
    const gl = this._gl;

    // Enable depth testing for 3D
    gl.enable(gl.DEPTH_TEST);

    // Create and compile shaders
    const computeVertexShader = this._createShader(gl.VERTEX_SHADER, shaderSources.get('compute_vertex.glsl'));
    const computeFragmentShader = this._createShader(gl.FRAGMENT_SHADER, shaderSources.get('compute_fragment.glsl'));
    const renderVertexShader = this._createShader(gl.VERTEX_SHADER, shaderSources.get('render_vertex.glsl'));
    const renderFragmentShader = this._createShader(gl.FRAGMENT_SHADER, shaderSources.get('render_fragment.glsl'));
    const wireframeVertexShader = this._createShader(gl.VERTEX_SHADER, shaderSources.get('wireframe_vertex.glsl'));
    const wireframeFragmentShader = this._createShader(gl.FRAGMENT_SHADER, shaderSources.get('wireframe_fragment.glsl'));

    // Create and configure compute program (3D face rendering with original compute_fragment.glsl)
    const computeProgram = this._createProgram(computeVertexShader, computeFragmentShader);
    this._compute = {
      program: computeProgram,
      positionLocation: gl.getAttribLocation(computeProgram, 'a_position'),
      colorCoordLocation: gl.getAttribLocation(computeProgram, 'a_colorCoord'),
      modelViewProjectionLocation: gl.getUniformLocation(computeProgram, 'u_modelViewProjection'),
      polarAxesLocation: gl.getUniformLocation(computeProgram, 'u_polarAxes'),
      colorSpaceIndexLocation: gl.getUniformLocation(computeProgram, 'u_colorSpaceIndex'),
      paletteColorsLocation: gl.getUniformLocation(computeProgram, 'u_paletteColors'),
      paletteCountLocation: gl.getUniformLocation(computeProgram, 'u_paletteCount'),
      distanceMetricLocation: gl.getUniformLocation(computeProgram, 'u_distanceMetric'),
      distanceThresholdLocation: gl.getUniformLocation(computeProgram, 'u_distanceThreshold'),
      highlightPaletteIndexLocation: gl.getUniformLocation(computeProgram, 'u_highlightPaletteIndex'),
      highlightModeLocation: gl.getUniformLocation(computeProgram, 'u_highlightMode'),
      showUnmatchedColorsLocation: gl.getUniformLocation(computeProgram, 'u_showUnmatchedColors'),
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
      highlightModeLocation: gl.getUniformLocation(renderProgram, 'u_highlightMode'),
    };

    // Create and configure wireframe program
    const wireframeProgram = this._createProgram(wireframeVertexShader, wireframeFragmentShader);
    this._wireframe = {
      program: wireframeProgram,
      positionLocation: gl.getAttribLocation(wireframeProgram, 'a_position'),
      modelViewProjectionLocation: gl.getUniformLocation(wireframeProgram, 'u_modelViewProjection'),
      depthTextureLocation: gl.getUniformLocation(wireframeProgram, 'u_depthTexture'),
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

    // Create depth texture instead of renderbuffer so we can sample it
    this._depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this._width, this._height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffer
    this._framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._colorTexture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._depthTexture, 0);

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
   * @param {Array<number>} vertices - Vertex data
   * @param {Array<number>} indices - Index data
   */
  _createGeometryBuffers(vertices, indices) {
    const gl = this._gl;

    // Create vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.flat()), gl.STATIC_DRAW);

    // Create index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
      vertexBuffer,
      indexBuffer,
      indexCount: indices.length
    };
  }

  /**
   * Generate 2d surface geometry data for a specific color space configuration
   * @param {ColorSpaceConfig} colorSpaceConfig - The color space configuration
   * @returns {Object} Object with vertices and indices arrays
   */
  _generate2DSurfaceGeometry(colorSpaceConfig) {
    // Calculate size to fill the viewport at the 2D camera distance
    const size = calculateViewportSize(CAMERA_DISTANCE);

    // Generate face based on the color space configuration using cube renderer techniques
    const colorSpace = colorSpaceConfig.colorSpace;
    const currentAxisIndex = colorSpace.getAxisIndex(colorSpaceConfig.currentAxis);

    const normalizedAxisSlices = this._normalizedAxisSlices(
      colorSpace, colorSpaceConfig.axisSlices);

    return generate2DFace(normalizedAxisSlices, currentAxisIndex, size);
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
   * @param {NamedColor|null} highlightColor - Color object to highlight (null for no highlight)
   */
  renderColorSpace(colorSpaceConfig, paletteColors = [], highlightColor = null) {
    // Store palette colors for consistency with indices
    this._paletteColors = [...paletteColors];

    // Calculate highlight index from color object
    const highlightPaletteIndex = this._findHighlightPaletteIndex(
      paletteColors, highlightColor);

    // Regenerate 2D face geometry
    const { vertices, indices } = this._generate2DSurfaceGeometry(colorSpaceConfig);
    this._colorGeometry = this._createGeometryBuffers(vertices, indices);

    // Generate rotation matrix to orient the face toward the camera
    const rotationMatrix = this._createFaceRotationMatrix(colorSpaceConfig);

    // First phase: Render 3D face to framebuffer for color computation
    this._renderToFramebuffer(colorSpaceConfig, paletteColors, rotationMatrix, highlightPaletteIndex);

    // Second phase: Display framebuffer texture to canvas
    this._renderToCanvas(colorSpaceConfig.showBoundaries, highlightPaletteIndex, colorSpaceConfig.highlightMode);

    // Update axis labels for the current color space configuration (maintain 2D functionality)
    const polarAxis = colorSpaceConfig.usePolarCoordinates ?
      colorSpaceConfig.colorSpace.availablePolarAxis(colorSpaceConfig.currentAxis) : null;
    this._updateAxisLabels(colorSpaceConfig, polarAxis);
  }

  /**
   * Render a 3D color space cube with rotation (same functionality as CubeRenderer)
   * @param {ColorSpaceConfig} colorSpaceConfig
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   * @param {NamedColor|null} highlightColor - Color object to highlight (null for no highlight)
   * @param {Float32Array} rotationMatrix - 4x4 rotation matrix for the cube
   */
  render3DColorSpace(colorSpaceConfig, paletteColors = [], highlightColor = null, rotationMatrix = null) {
    // Store palette colors for consistency with indices
    this._paletteColors = [...paletteColors];

    // Calculate highlight index from color object
    const highlightPaletteIndex = this._findHighlightPaletteIndex(
      paletteColors, highlightColor);

    // Get normalized axis slices and create 3D geometry
    const normalizedSlices = this._normalizedAxisSlices(colorSpaceConfig.colorSpace, colorSpaceConfig.axisSlices);
    const { vertices, indices } = colorSpaceConfig.usePolarCoordinates
      ? generateCylinderSurface(normalizedSlices, CUBE_SIZE_3D)
      : generateCubeSurface(normalizedSlices, CUBE_SIZE_3D);

    // Add internal slices if we can see inside of the cube.
    if (!colorSpaceConfig.showUnmatchedColors || colorSpaceConfig.highlightMode === 'hide-other') {
      const sliceGeometry = generateCrossSections(normalizedSlices, rotationMatrix, CUBE_SIZE_3D);
      const vertexOffset = vertices.length;
      vertices.push(...sliceGeometry.vertices);
      indices.push(...sliceGeometry.indices.map(i => i + vertexOffset));
    }
    this._colorGeometry = this._createGeometryBuffers(vertices, indices);

    // Generate wireframe geometry for the unsliced cube
    const normalizedFull = this._normalizedAxisSlices(colorSpaceConfig.colorSpace, new Map());
    const wireframeData = colorSpaceConfig.usePolarCoordinates ?
      generateCylinderWireframe(normalizedFull, CUBE_SIZE_3D) :
      generateCubeWireframe(normalizedSlices, normalizedFull, CUBE_SIZE_3D);
    this._wireframeGeometry = this._createGeometryBuffers(
      wireframeData.vertices, wireframeData.indices);

    // First phase: Render 3D cube to framebuffer for color computation
    this._renderToFramebuffer(colorSpaceConfig, paletteColors, rotationMatrix, highlightPaletteIndex);

    // Second phase: Display framebuffer texture to canvas
    this._renderToCanvas(colorSpaceConfig.showBoundaries, highlightPaletteIndex, colorSpaceConfig.highlightMode);

    // Third phase: Render wireframe overlay with proper depth testing
    this._renderWireframeOverlay(rotationMatrix);

    clearElement(this._axisContainer);
  }

  /**
   * Find the index of a color object in the palette
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to search
   * @param {NamedColor|null} highlightColor - Color object to find
   * @returns {number} Index of the color in the palette, or -1 if not found/no highlight
   */
  _findHighlightPaletteIndex(paletteColors, highlightColor) {
    return highlightColor ? paletteColors.indexOf(highlightColor) : -1;
  }

  /**
   * Compute colors into the framebuffer
   * @param {ColorSpaceConfig} colorSpaceConfig
   * @param {Array<NamedColor>} paletteColors - Array of palette colors to find closest matches for
   * @param {Float32Array} rotationMatrix - 4x4 rotation matrix for the cube (only used for 3D)
   * @param {number} highlightPaletteIndex - Index of palette color to highlight (-1 for no highlight)
   */
  _renderToFramebuffer(colorSpaceConfig, paletteColors, rotationMatrix = null, highlightPaletteIndex = -1) {
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this._colorGeometry.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._colorGeometry.indexBuffer);

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

    // Set polar axes uniform
    gl.uniform2iv(
      this._compute.polarAxesLocation,
      this._makePolarAxesVariable(colorSpaceConfig));

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

    // Set highlight uniforms
    gl.uniform1i(this._compute.highlightPaletteIndexLocation, highlightPaletteIndex);

    // Set highlight mode uniform (index into getAllHighlightModes array)
    const highlightModeIndex = getAllHighlightModes().indexOf(colorSpaceConfig.highlightMode);
    gl.uniform1i(this._compute.highlightModeLocation, highlightModeIndex >= 0 ? highlightModeIndex : 0);

    // Set show unmatched colors uniform
    gl.uniform1i(
      this._compute.showUnmatchedColorsLocation,
      colorSpaceConfig.showUnmatchedColors ? 1 : 0);

    // Draw using unified geometry
    gl.drawElements(gl.TRIANGLES, this._colorGeometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Create a variable for the polar axes based on the color space configuration
   * @param {ColorSpaceConfig} colorSpaceConfig
   * @returns {Array<number>} - Array containing the indices of the radial and polar axes
   */
  _makePolarAxesVariable(colorSpaceConfig) {
    if (!colorSpaceConfig.usePolarCoordinates) return [-1, -1];
    const colorSpace = colorSpaceConfig.colorSpace;
    const currentAxis =
      colorSpaceConfig.render3d ? colorSpace.getAllAxes()[2] : colorSpaceConfig.currentAxis;
    const polarAxis = colorSpace.availablePolarAxis(currentAxis);

    const rAxis = colorSpace.getAllAxes().find(
      axis => axis !== polarAxis && axis !== currentAxis);

    if (!polarAxis || !rAxis) return [-1, -1];

    return [colorSpace.getAxisIndex(rAxis), colorSpace.getAxisIndex(polarAxis)];
  }

  /**
   * Render phase: Render framebuffer texture to canvas for display
   * @param {boolean} showBoundaries - Whether to show region boundaries
   * @param {number} highlightPaletteIndex - Index of palette color to highlight (-1 for no highlight)
   * @param {string} highlightMode - Highlight mode ('dim-other' or 'hide-other')
   */
  _renderToCanvas(showBoundaries = true, highlightPaletteIndex = -1, highlightMode = 'dim-other') {
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

    // Set highlight palette index uniform
    gl.uniform1i(this._render.highlightPaletteIndexLocation, highlightPaletteIndex);

    // Set highlight mode uniform (index into getAllHighlightModes array)
    const highlightModeIndex = getAllHighlightModes().indexOf(highlightMode);
    gl.uniform1i(this._render.highlightModeLocation, highlightModeIndex >= 0 ? highlightModeIndex : 0);

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Re-enable depth testing for subsequent 3D rendering
    gl.enable(gl.DEPTH_TEST);
  }

  /**
   * Render wireframe overlay with manual occlusion using depth texture sampling
   * @param {Float32Array} rotationMatrix - 4x4 rotation matrix for the cube
   */
  _renderWireframeOverlay(rotationMatrix = null) {
    const gl = this._gl;

    // Render wireframe to default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this._width, this._height);

    // Enable blending for semi-transparent wireframe
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Enable depth testing, but don't write to depth buffer
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);

    // Use wireframe program
    gl.useProgram(this._wireframe.program);

    // Set up vertex attributes for wireframe
    gl.bindBuffer(gl.ARRAY_BUFFER, this._wireframeGeometry.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._wireframeGeometry.indexBuffer);

    gl.enableVertexAttribArray(this._wireframe.positionLocation);
    gl.vertexAttribPointer(this._wireframe.positionLocation, 3, gl.FLOAT, false, 12, 0);

    // Compute transformation matrix (apply rotation if provided)
    const finalMvpMatrix = rotationMatrix
      ? mat4.multiply(mat4.create(), this._mvpMatrix, rotationMatrix)
      : this._mvpMatrix;

    // Set transformation matrix uniform
    gl.uniformMatrix4fv(this._wireframe.modelViewProjectionLocation, false, finalMvpMatrix);

    // Bind depth texture for manual occlusion testing
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._depthTexture);
    gl.uniform1i(this._wireframe.depthTextureLocation, 1);

    // Draw wireframe lines
    gl.drawElements(gl.LINES, this._wireframeGeometry.indexCount, gl.UNSIGNED_SHORT, 0);

    // Restore depth mask and disable blending
    gl.depthMask(true);
    gl.disable(gl.BLEND);
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
   * Normalize axis slices to [0, 1] range and fill in missing axes
   * @param {ColorSpace} colorSpace
   * @param {Map} axisSlices
   * @returns {Array} Array of normalized axis ranges
   */
  _normalizedAxisSlices(colorSpace, axisSlices) {
    const normalizedAxes = [];
    for (const axis of colorSpace.getAllAxes()) {
      const range = axisSlices.get(axis) || [axis.min, axis.max];
      const fullRange = axis.max - axis.min;
      const normalizedRange = [
        (range[0] - axis.min) / fullRange,
        (range[1] - axis.min) / fullRange
      ];
      normalizedAxes.push(normalizedRange);
    }
    return normalizedAxes;
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
