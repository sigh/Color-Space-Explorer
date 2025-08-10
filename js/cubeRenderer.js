import { RgbColor } from "./colorSpace.js";

// Import gl-matrix for efficient matrix operations
import '../lib/gl-matrix-min.js';
const { mat4 } = glMatrix;

/**
 * WebGL2 3D Cube renderer for color spaces
 */
export class CubeRenderer {
  constructor(canvasContainer, cubeVertexShaderSource, cubeFragmentShaderSource) {
    console.log('CubeRenderer: Initializing...');
    const canvas = canvasContainer.querySelector('canvas');
    this._gl = canvas.getContext('webgl2');

    if (!this._gl) {
      throw new Error('WebGL2 not supported');
    }

    this._width = canvas.width;
    this._height = canvas.height;

    // Camera rotation state - maintain rotation as a matrix
    this._rotationMatrix = mat4.create();

    this._initWebGL(cubeVertexShaderSource, cubeFragmentShaderSource);
    this._setupMouseControls(canvasContainer.parentElement);
  }

  /**
   * Factory function to create a CubeRenderer with shader loading
   * @param {HTMLElement} canvasContainer - The container for the canvas element
   * @returns {Promise<CubeRenderer>} - Promise that resolves to initialized renderer
   */
  static async create(canvasContainer) {
    // Load shaders from files
    const [cubeVertexShaderSource, cubeFragmentShaderSource] = await Promise.all([
      fetch('./shaders/cube_vertex.glsl').then(r => r.text()),
      fetch('./shaders/cube_fragment.glsl').then(r => r.text())
    ]);

    return new CubeRenderer(
      canvasContainer,
      cubeVertexShaderSource,
      cubeFragmentShaderSource
    );
  }

  /**
   * Initialize WebGL shaders and buffers
   */
  _initWebGL(cubeVertexShaderSource, cubeFragmentShaderSource) {
    const gl = this._gl;

    // Enable depth testing for 3D
    gl.enable(gl.DEPTH_TEST);

    // Create and compile shaders
    const vertexShader = this._createShader(gl.VERTEX_SHADER, cubeVertexShaderSource);
    const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, cubeFragmentShaderSource);

    // Create program
    const program = this._createProgram(vertexShader, fragmentShader);
    this._program = {
      program: program,
      positionLocation: gl.getAttribLocation(program, 'a_position'),
      colorCoordLocation: gl.getAttribLocation(program, 'a_colorCoord'),
      modelViewProjectionLocation: gl.getUniformLocation(program, 'u_modelViewProjection'),
    };

    // Create cube geometry
    this._createCubeGeometry();

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
  _setupMouseControls(element) {
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
      this._render();
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
   * @param {Array<NamedColor>} paletteColors - Array of palette colors (unused in MVP)
   * @param {number|null} highlightPaletteIndex - Index of palette color to highlight (unused in MVP)
   */
  renderColorSpace(colorSpaceView, paletteColors = [], highlightPaletteIndex = null) {
    this._currentColorSpaceView = colorSpaceView;
    this._render();
  }

  /**
   * Internal render method
   */
  _render() {
    if (!this._currentColorSpaceView) return;

    const gl = this._gl;

    // Clear and setup
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this._program.program);

    // Set up vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.enableVertexAttribArray(this._program.positionLocation);
    gl.vertexAttribPointer(this._program.positionLocation, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this._program.colorCoordLocation);
    gl.vertexAttribPointer(this._program.colorCoordLocation, 3, gl.FLOAT, false, 24, 12);

    // Create transformation matrix
    const mvpMatrix = mat4.create();
    mat4.perspective(mvpMatrix, Math.PI / 3, this._width / this._height, 0.1, 100.0);
    mat4.translate(mvpMatrix, mvpMatrix, [0, 0, -2.5]);
    mat4.multiply(mvpMatrix, mvpMatrix, this._rotationMatrix);

    // Draw
    gl.uniformMatrix4fv(this._program.modelViewProjectionLocation, false, mvpMatrix);
    gl.drawElements(gl.TRIANGLES, this._indexCount, gl.UNSIGNED_SHORT, 0);
  }

  /**
   * Get color at canvas coordinates (simplified implementation for MVP)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Array} Tuple [RgbColor, null] - closest color always null for MVP
   */
  getColorAt(x, y) {
    // For MVP, return a simple color based on position
    // In a full implementation, this would do ray casting into the 3D scene
    const normalizedX = Math.max(0, Math.min(1, x / this._width));
    const normalizedY = Math.max(0, Math.min(1, 1.0 - (y / this._height)));

    const rgbColor = new RgbColor(normalizedX, normalizedY, 0.5);
    return [rgbColor, null];
  }

  /**
   * Wait for rendering to complete (simplified for MVP)
   */
  async waitForCurrentRender() {
    // For MVP, just wait one frame
    return new Promise(resolve => requestAnimationFrame(resolve));
  }
}
