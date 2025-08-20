// Import gl-matrix for efficient matrix operations
import '../lib/gl-matrix-min.js';
const { vec3 } = glMatrix;

const CROSS_SECTION_SCALE = 1 / 64.0;
const CYLINDER_RADIAL_SEGMENTS = 16;
const CYLINDER_AXIS = 2; // Z-axis by default

/**
 * Generate 3D cube geometry with all faces
 * @param {Array} normalizedSlices - Array of normalized [min, max] ranges for each axis
 * @param {number} size - Size of the cube
 * @returns {Object} Object with vertices and indices arrays
 */
export function generateCubeSurface(normalizedSlices, size) {
  // Generate all 8 corners of the cube with RGB color coordinates
  const corners = generateCubeCornerColors(
    normalizedSlices).map(
      c => colorCoordToVertex(c, size));

  // Generate faces programmatically - each face shares one coordinate
  const vertices = [];
  const indices = [];

  // Generate 6 faces (3 axes × 2 directions each)
  for (let axis = 0; axis < 3; axis++) {
    for (let direction = 0; direction < 2; direction++) {
      const baseIndex = vertices.length;

      // Find the 4 corners that belong to this face
      const faceCorners = filterCubeCornersByFace(
        corners, axis, direction);

      // Add vertices for this face
      vertices.push(...faceCorners);

      // Add triangles for this face (quad split into 2 triangles)
      indices.push(...generateCubeFaceIndexes(baseIndex));
    }
  }

  return { vertices, indices };
}

/**
 * Generate wireframe geometry for the full unsliced cube
 * @param {Map} normalizedAxisSlices - The normalized axis slices for the wireframe
 * @param {Map} normalizedAxisFull - The normalized axis for the full cube
 * @param {number} size - Size of the cube
 * @returns {Object} Object with vertices and indices arrays for wireframe rendering
 */
export function generateCubeWireframe(normalizedAxisSlices, normalizedAxisFull, size) {
  const sliceCorners = generateCubeCornerColors(normalizedAxisSlices);
  const fullCorners = generateCubeCornerColors(normalizedAxisFull);

  // Extract only position data (first 3 components) for wireframe
  const vertices = [...sliceCorners, ...fullCorners].map(
    c => colorCoordToPosition(c, size));

  // Generate line indices for wireframe (12 edges of the cube)
  const cubeIndices = generateCubeWireframeIndices();
  const numSliceVertices = sliceCorners.length;
  const indices = [
    ...cubeIndices,
    ...cubeIndices.map(i => i + numSliceVertices)];

  return { vertices, indices };
}

/**
 * Generate internal cross-sections of the cube, with surfaces facing the camera.
 * @param {Array} normalizedSlices - Normalized axis ranges
 * @param {Array} rotationMatrix - 4x4 rotation matrix
 * @param {number} size - Size of the cube
 * @returns {Object} Object with combined vertices and indices arrays
 */
export function generateCrossSections(normalizedSlices, rotationMatrix, size) {
  const vertices = [];
  const indices = [];

  const cornerColors = generateCubeCornerColors(normalizedSlices);

  // Transform corners to view space so that cross-sections are along the z-axis
  const rotatedCorners = cornerColors.map(corner => {
    return vec3.transformMat4(
      vec3.create(),
      colorCoordToPosition(corner, size),
      rotationMatrix);
  });

  const edgeIndices = generateCubeWireframeIndices();

  // Find depth bounds and generate cross-sections
  const zValues = rotatedCorners.map(corner => corner[2]);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  const crossSectionWidth = size * CROSS_SECTION_SCALE;

  // Generate cross-sections (exclude endpoints which are handled by cube faces)
  for (let z = minZ + crossSectionWidth; z < maxZ; z += crossSectionWidth) {
    const intersections = [];
    let vertexOffset = vertices.length;

    // Find edges that intersect with the cross-section plane
    for (let i = 0; i < edgeIndices.length; i += 2) {
      const startIndex = edgeIndices[i];
      const endIndex = edgeIndices[i + 1];
      const startZ = zValues[startIndex];
      const endZ = zValues[endIndex];

      // Check if edge crosses the plane
      if ((startZ <= z && endZ >= z) || (startZ >= z && endZ <= z)) {
        const t = (z - startZ) / (endZ - startZ);

        // Store 2D intersection point for polygon sorting
        const start = rotatedCorners[startIndex];
        const end = rotatedCorners[endIndex];
        const intersection = vec3.lerp(vec3.create(), start, end, t);
        intersections.push([intersection[0], intersection[1]]);

        // Interpolate full vertex data (position + color coordinates)
        const interpColor = cornerColors[startIndex].map(
          (v, j) => v + (cornerColors[endIndex][j] - v) * t);
        vertices.push(
          colorCoordToVertex(interpColor, size));
      }
    }

    // Triangulate polygon if we have enough vertices
    if (intersections.length >= 3) {
      const sortOrder = polygonVertexSortOrder(intersections);
      // Fan triangulation from first vertex
      for (let i = 0; i < sortOrder.length - 2; i++) {
        indices.push(
          vertexOffset + sortOrder[0],
          vertexOffset + sortOrder[i + 1],
          vertexOffset + sortOrder[i + 2]
        );
      }
    }
  }

  return { vertices, indices };
}

/**
 * Generate 2d surface geometry
 * @param {Array} normalizedAxisSlices - The normalized axis slices for the 2D face
 * @param {number} viewingAxisIndex - The axis being viewed (0, 1, or 2)
 * @param {number} size - The size of the cube
 * @returns {Object} Object with vertices and indices arrays
 */
export function generate2DFace(normalizedAxisSlices, viewingAxisIndex, size) {
  // Generate cube corners
  const allCorners = generateCubeCornerColors(
    normalizedAxisSlices).map(
      c => colorCoordToVertex(c, size));

  // Get the face that corresponds to the fixed axis
  // Direction 1 means the positive face of the axis
  const faceCorners = filterCubeCornersByFace(
    allCorners, viewingAxisIndex, 1);

  // Position Z to 0 for 2D face
  for (const corner of faceCorners) {
    corner[viewingAxisIndex] = 0.0;
  }

  // Create vertices array from corners and simple indices for single face
  const vertices = faceCorners;
  const indices = generateCubeFaceIndexes(0);

  return { vertices, indices };
}

/**
 * Generate vertices for a cylinder with square ends along the Z-axis
 * @param {Array} normalizedSlices - Array of normalized [min, max] ranges for each axis
 * @param {number} size - Size of the cube containing the cylinder
 * @returns {Object} Object with vertices and indices arrays
 */
export function generateCylinderSurface(normalizedSlices, size) {
  const vertices = [];
  const indices = [];

  // Use static constants
  const cylinderAxis = CYLINDER_AXIS;
  const radialSegments = CYLINDER_RADIAL_SEGMENTS;

  // Generate cube corners first to get exact same geometry as cube faces
  const allCorners = generateCubeCornerColors(normalizedSlices);
  const allVertices = allCorners.map(c => colorCoordToVertex(c, size));

  // Get bottom face (direction 0 for cylinderAxis)
  const bottomFaceVertices = filterCubeCornersByFace(allVertices, cylinderAxis, 0);
  vertices.push(...bottomFaceVertices);
  indices.push(...generateCubeFaceIndexes(0));

  // Get top face (direction 1 for cylinderAxis)
  const topFaceVertices = filterCubeCornersByFace(allVertices, cylinderAxis, 1);
  vertices.push(...topFaceVertices);
  indices.push(...generateCubeFaceIndexes(4));

  // Get the other two axes for the circular cross-section
  const axis1 = (cylinderAxis + 1) % 3;
  const axis2 = (cylinderAxis + 2) % 3;
  const axis1Range = normalizedSlices[axis1];
  const axis2Range = normalizedSlices[axis2];
  const cylinderRange = normalizedSlices[cylinderAxis];
  const cylinderMin = cylinderRange[0];
  const cylinderMax = cylinderRange[1];

  // Curved sides - segmented cylinder surface

  // Part 1: Compute points on a 2D circle (with one extra point to avoid wrapping)
  const circlePoints = [];
  for (let r = 0; r <= radialSegments; r++) { // <= to include extra point
    const angle = (r / radialSegments) * 2 * Math.PI;
    const x1 = Math.cos(angle) * 0.5 + 0.5;
    const y1 = Math.sin(angle) * 0.5 + 0.5;

    // Map to axis ranges
    const x = axis1Range[0] + (axis1Range[1] - axis1Range[0]) * x1;
    const y = axis2Range[0] + (axis2Range[1] - axis2Range[0]) * y1;

    circlePoints.push({ x, y });
  }

  const addCoord = (pos, level) => {
    const colorCoord = [0, 0, 0];
    colorCoord[axis1] = pos.x;
    colorCoord[axis2] = pos.y;
    colorCoord[cylinderAxis] = level;
    vertices.push(colorCoordToVertex(colorCoord, size));
  };

  // Part 2: Generate 3D triangles from circle points (independent of radialSegments)
  for (let i = 1; i < circlePoints.length; i++) {
    const current = circlePoints[i - 1];
    const next = circlePoints[i];

    // Add vertices for this segment (bottom and top for current and next positions)
    const segmentStart = vertices.length;

    addCoord(current, cylinderMin);
    addCoord(next, cylinderMin);
    addCoord(current, cylinderMax);
    addCoord(next, cylinderMax);

    // Create two triangles for this segment
    const bottomCurrent = segmentStart;
    const bottomNext = segmentStart + 1;
    const topCurrent = segmentStart + 2;
    const topNext = segmentStart + 3;

    indices.push(bottomCurrent, bottomNext, topCurrent);
    indices.push(bottomNext, topNext, topCurrent);
  }

  return { vertices, indices };
}

/**
 * Generate wireframe geometry for a cylinder
 * @param {Array} normalizedSlices - Array of normalized [min, max] ranges for each axis
 * @param {number} size - Size of the cube containing the cylinder
 * @returns {Object} Object with vertices and indices arrays for wireframe rendering
 */
export function generateCylinderWireframe(normalizedSlices, size) {
  const vertices = [];
  const indices = [];

  // Use static constants
  const cylinderAxis = CYLINDER_AXIS;
  const radialSegments = CYLINDER_RADIAL_SEGMENTS;

  // Get the range along the cylinder axis
  const cylinderRange = normalizedSlices[cylinderAxis];
  const cylinderMin = cylinderRange[0];
  const cylinderMax = cylinderRange[1];

  // Get the other two axes for the circular cross-section
  const axis1 = (cylinderAxis + 1) % 3;
  const axis2 = (cylinderAxis + 2) % 3;
  const axis1Range = normalizedSlices[axis1];
  const axis2Range = normalizedSlices[axis2];

  // Generate vertices for top and bottom circles
  for (let level = 0; level < 2; level++) {
    const cylinderPos = level === 0 ? cylinderMin : cylinderMax;

    for (let r = 0; r < radialSegments; r++) {
      const angle = (r / radialSegments) * 2 * Math.PI;
      const u = Math.cos(angle) * 0.5 + 0.5;
      const v = Math.sin(angle) * 0.5 + 0.5;

      const pos1 = axis1Range[0] + (axis1Range[1] - axis1Range[0]) * u;
      const pos2 = axis2Range[0] + (axis2Range[1] - axis2Range[0]) * v;

      const colorCoord = [0, 0, 0];
      colorCoord[cylinderAxis] = cylinderPos;
      colorCoord[axis1] = pos1;
      colorCoord[axis2] = pos2;

      vertices.push(colorCoordToPosition(colorCoord, size));
    }
  }

  // Generate wireframe indices
  // Circle edges for top and bottom
  for (let level = 0; level < 2; level++) {
    const baseIndex = level * radialSegments;
    for (let r = 0; r < radialSegments; r++) {
      const current = baseIndex + r;
      const next = baseIndex + ((r + 1) % radialSegments);
      indices.push(current, next);
    }
  }

  // Vertical edges connecting top and bottom
  for (let r = 0; r < radialSegments; r += Math.max(1, Math.floor(radialSegments / 4))) {
    indices.push(r, r + radialSegments); // Connect bottom to top
  }

  return { vertices, indices };
}

/**
 * Generate all 8 corners of a cube using bit patterns
 * @param {number} size - Base size of the cube
 * @param {Array} normalizedSlices - Array of normalized [min, max] ranges for each axis
 * @returns {Array} Array of 8 corners, each with [x, y, z, colorCoord0, colorCoord1, colorCoord2]
 */
function generateCubeCornerColors(normalizedSlices) {
  const corners = [];

  // Generate 8 corners using 3-bit patterns: 000, 001, 010, 011, 100, 101, 110, 111
  for (let i = 0; i < 8; i++) {
    const colorCoords = [
      normalizedSlices[0][i & 1],         // x axis
      normalizedSlices[1][(i & 2) >> 1],  // y axis
      normalizedSlices[2][(i & 4) >> 2]   // z axis
    ];
    corners.push(colorCoords);
  }

  return corners;
}

/**
 * Generate the indices for a single face of the cube
 * @param {number} baseIndex
 * @returns
 */
function generateCubeFaceIndexes(baseIndex) {
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
function filterCubeCornersByFace(corners, axisIndex, direction) {
  return corners.filter((_, i) => {
    // Check the bit corresponding to the axis index
    return ((i >> axisIndex) & 1) === direction;
  });
}

/**
 * Generate wireframe indices for a cube's 12 edges
 * @returns {Array<number>} Array of line indices for wireframe rendering
 */
function generateCubeWireframeIndices() {
  const indices = [];
  const numVertices = 8;

  for (let i = 0; i < numVertices; i++) {
    // Only create edges from vertices where the given axis bit is 1.
    // This elegantly prevents duplicate edges (e.g., creating 0-1 and 1-0).

    // Connect along X axis (flips the 1st bit)
    if (i & 1) indices.push(i, i ^ 1);

    // Connect along Y axis (flips the 2nd bit)
    if (i & 2) indices.push(i, i ^ 2);

    // Connect along Z axis (flips the 3rd bit)
    if (i & 4) indices.push(i, i ^ 4);
  }

  return indices;
}

/**
 * Sorts the vertices of a 2d polygon (array of vec2)
 * @param {Array<vec2>} vertices - The vertices to sort.
 * @returns {Array<number>} The indexes of the sorted vertices.
 */
function polygonVertexSortOrder(vertices) {
  const n = vertices.length;

  // Calculate the centroid
  const centerX = vertices.reduce((sum, v) => sum + v[0], 0) / n;
  const centerY = vertices.reduce((sum, v) => sum + v[1], 0) / n;

  // Sort vertices based on their angle from the center
  return vertices.map((v, i) => ({
    index: i,
    angle: Math.atan2(v[1] - centerY, v[0] - centerX)
  }))
    .sort((a, b) => a.angle - b.angle)
    .map(v => v.index);
}

/**
 * Converts a color coordinate to a 3D position in the cylinder.
 * @param {Array<number>} colorCoord
 * @param {number} size
 * @returns {Array<number>}
 */
function colorCoordToPosition(colorCoord, size) {
  return colorCoord.map(coord => (coord - 0.5) * size);
}

/**
 * Converts a color coordinate to a vertex in 3D space.
 * @param {Array<number>} colorCoord
 * @param {number} size
 * @returns {Array<number>}
 */
function colorCoordToVertex(colorCoord, size) {
  const position = colorCoordToPosition(colorCoord, size);
  return [...position, ...colorCoord];
}