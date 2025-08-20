// Import gl-matrix for efficient matrix operations
import '../lib/gl-matrix-min.js';
const { vec3 } = glMatrix;

const CROSS_SECTION_SCALE = 1 / 64.0;
const CYLINDER_RADIAL_SEGMENTS = 16;
const CYLINDER_SEGMENT_ANGLE = (Math.PI * 2) / CYLINDER_RADIAL_SEGMENTS;
const CYLINDER_SAGITTA = 1 - Math.sqrt((1 + Math.cos(CYLINDER_SEGMENT_ANGLE)) / 2);
const CUBE_SIZE_3D = 1;

export const ANGULAR_AXIS = 0;
export const RADIAL_AXIS = 1;
export const CYLINDER_AXIS = 2;

const FULL_NORMALIZED_AXES = [[0, 1], [0, 1], [0, 1]];

/**
 * Determine how much to offset the radial axis range to ensure that circle
 * sides remain within view.
 * @param {number} diameter
 * @returns {number}
 */
export function getRadialAxisOffset(diameter) {
  return diameter * CYLINDER_SAGITTA;
}

/**
 * Generate 3D cube geometry with all faces
 * @param {Array} normalizedSlices - Array of normalized [min, max] ranges for each axis
 * @returns {Object} Object with vertices and indices arrays
 */
export function generateCubeSurface(normalizedSlices) {
  // Generate all 8 corners of the cube with RGB color coordinates
  const corners = generateCubeCornerColors(
    normalizedSlices).map(
      c => colorCoordToVertex(c, CUBE_SIZE_3D));

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
      indices.push(...generateFaceIndexes(baseIndex));
    }
  }

  return { vertices, indices };
}

/**
 * Generate wireframe geometry for the full unsliced cube
 * @param {Map} normalizedAxisSlices - The normalized axis slices for the wireframe
 * @returns {Object} Object with vertices and indices arrays for wireframe rendering
 */
export function generateCubeWireframe(normalizedAxisSlices) {
  const sliceCorners = generateCubeCornerColors(normalizedAxisSlices);
  const fullCorners = generateCubeCornerColors(FULL_NORMALIZED_AXES);

  // Extract only position data (first 3 components) for wireframe
  const vertices = [...sliceCorners, ...fullCorners].map(
    c => colorCoordToPosition(c, CUBE_SIZE_3D));

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
 * @param {Array} rotationMatrix - 4x4 rotation matrix
 * @returns {Object} Object with combined vertices and indices arrays
 */
export function generateCrossSections(rotationMatrix) {
  const vertices = [];
  const indices = [];

  const cornerColors = generateCubeCornerColors(FULL_NORMALIZED_AXES);

  // Transform corners to view space so that cross-sections are along the z-axis
  const rotatedCorners = cornerColors.map(corner => {
    return vec3.transformMat4(
      vec3.create(),
      colorCoordToPosition(corner, CUBE_SIZE_3D),
      rotationMatrix);
  });

  const edgeIndices = generateCubeWireframeIndices();

  // Find depth bounds and generate cross-sections
  const zValues = rotatedCorners.map(corner => corner[2]);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  const crossSectionWidth = CUBE_SIZE_3D * CROSS_SECTION_SCALE;

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
          colorCoordToVertex(interpColor, CUBE_SIZE_3D));
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
  const indices = generateFaceIndexes(0);

  return { vertices, indices };
}

/**
 * Generate vertices for a cylinder with square ends along the Z-axis
 * @param {Array} normalizedSlices - Array of normalized [min, max] ranges for each axis
 * @returns {Object} Object with vertices and indices arrays
 */
export function generateCylinderSurface(normalizedSlices) {
  const vertices = [];
  const indices = [];

  // Generate cube corners first to get exact same geometry as cube faces
  const faceSlices = [...FULL_NORMALIZED_AXES];
  faceSlices[CYLINDER_AXIS] = normalizedSlices[CYLINDER_AXIS];
  const allCorners = generateCubeCornerColors(faceSlices);
  const allVertices = allCorners.map(c => colorCoordToVertex(c, CUBE_SIZE_3D));

  // Get bottom face (direction 0 for cylinderAxis)
  vertices.push(...filterCubeCornersByFace(allVertices, CYLINDER_AXIS, 0));
  indices.push(...generateFaceIndexes(0));

  // Get top face (direction 1 for cylinderAxis)
  vertices.push(...filterCubeCornersByFace(allVertices, CYLINDER_AXIS, 1));
  indices.push(...generateFaceIndexes(4));

  // Generate the cylinder body using segments.
  const cylinderMin = normalizedSlices[CYLINDER_AXIS][0];
  const cylinderMax = normalizedSlices[CYLINDER_AXIS][1];

  const generateCylinderBody = (circlePoints) => {
    const segmentStart = vertices.length;

    for (let i = 0; i < circlePoints.length; i++) {
      const pos = circlePoints[i];
      vertices.push(colorCoordToVertex([pos.x, pos.y, cylinderMin], CUBE_SIZE_3D));
      vertices.push(colorCoordToVertex([pos.x, pos.y, cylinderMax], CUBE_SIZE_3D));
    }

    for (let i = 0; i < circlePoints.length - 1; i++) {
      indices.push(...generateFaceIndexes(segmentStart + 2 * i));
    }
  };

  const outerCirclePoints = generateCirclePoints(normalizedSlices[RADIAL_AXIS][1]);
  generateCylinderBody(outerCirclePoints);
  const innerDiameter = normalizedSlices[RADIAL_AXIS][0];
  if (innerDiameter > 0) {
    const innerCirclePoints = generateCirclePoints(innerDiameter);
    generateCylinderBody(innerCirclePoints);
  }

  // Add internal surfaces if the slice is a wedge.
  const minTurnAngle = normalizedSlices[ANGULAR_AXIS][0];
  const maxTurnAngle = normalizedSlices[ANGULAR_AXIS][1];
  if (minTurnAngle > 0 || maxTurnAngle < 1) {
    const EPSILON = 0.001; // Small value to avoid precision issues
    const radialRange = normalizedSlices[RADIAL_AXIS];
    const cylinderRange = normalizedSlices[CYLINDER_AXIS];

    indices.push(...generateFaceIndexes(vertices.length));
    vertices.push(
      ...generateCylinderWedgeCoords(minTurnAngle + EPSILON, radialRange, cylinderRange).map(
        c => colorCoordToVertex(c, CUBE_SIZE_3D)
      )
    );
    indices.push(...generateFaceIndexes(vertices.length));
    vertices.push(
      ...generateCylinderWedgeCoords(maxTurnAngle - EPSILON, radialRange, cylinderRange).map(
        c => colorCoordToVertex(c, CUBE_SIZE_3D)
      )
    );
  }

  return { vertices, indices };
}

/**
 * Generate wireframe geometry for a cylinder
 * @param {Array} normalizedSlices - Array of normalized [min, max] ranges for each axis
 * @returns {Object} Object with vertices and indices arrays for wireframe rendering
 */
export function generateCylinderWireframe(normalizedSlices) {
  const vertices = [];
  const indices = [];

  // Generate the wireframe for the cylinder ends.
  for (const ranges of [normalizedSlices, FULL_NORMALIZED_AXES]) {
    const cylinderRange = ranges[CYLINDER_AXIS];
    const radialRange = ranges[RADIAL_AXIS];
    for (const d of radialRange) {
      if (d === 0) continue;
      const circlePoints = generateCirclePoints(d, ...ranges[ANGULAR_AXIS]);
      const numPoints = circlePoints.length;

      // Draw the circle.
      for (const cylinderPos of cylinderRange) {
        const baseIndex = vertices.length;
        for (let r = 0; r < numPoints; r++) {
          const { x, y } = circlePoints[r];

          const colorCoord = [x, y, cylinderPos];
          vertices.push(colorCoordToPosition(colorCoord, CUBE_SIZE_3D));
        }

        for (let r = 1; r < numPoints; r++) {
          indices.push(baseIndex + r - 1, baseIndex + r);
        }
      }

    }
  }

  // Draw the wedge faces.
  const angularRange = normalizedSlices[ANGULAR_AXIS];
  const cylinderRange = normalizedSlices[CYLINDER_AXIS];
  const radialRange = normalizedSlices[RADIAL_AXIS];
  if (angularRange[0] > 0 || angularRange[1] < 1) {
    for (const angularPos of angularRange) {
      const baseIndex = vertices.length;
      vertices.push(
        ...generateCylinderWedgeCoords(angularPos, radialRange, cylinderRange).map(
          c => colorCoordToPosition(c, CUBE_SIZE_3D)
        )
      );
      indices.push(
        baseIndex, baseIndex + 1,
        baseIndex + 2, baseIndex + 3,
        baseIndex, baseIndex + 2,
        baseIndex + 1, baseIndex + 3);
    }
  }

  // Draw 4 lines along the cylinder body
  for (let r = 0; r < 1; r += 0.25) {
    const { x, y } = polarToCartesian(1, r * 2 * Math.PI);
    const baseIndex = vertices.length;
    vertices.push(colorCoordToPosition([x, y, 0], CUBE_SIZE_3D));
    vertices.push(colorCoordToPosition([x, y, 1], CUBE_SIZE_3D));
    indices.push(baseIndex, baseIndex + 1);
  }

  return { vertices, indices };
}

/**
 * Convert polar coordinates to Cartesian coordinates
 * @param {*} d - The distance from the center
 * @param {*} angle - The angle in radians
 * @returns {Object} The Cartesian coordinates { x, y }
 */
function polarToCartesian(d, angle) {
  return {
    x: d * Math.sin(angle) / 2 + 0.5,
    y: d * Math.cos(angle) / 2 + 0.5
  };
}

/**
 * Generate the coordinates for a wedge faces of the cylinder
 * @param {number} angularPos - The angular position of the wedge (0 to 1)
 * @param {Array} radialRange - The radial range [min, max] for the wedge
 * @param {Array} cylinderRange - The cylinder range [min, max] for the wedge
 * @returns {Array} Array of [x, y, z] coordinates for the wedge
 */
function generateCylinderWedgeCoords(angularPos, radialRange, cylinderRange) {
  const coords = [];
  const angle = angularPos * 2 * Math.PI;
  for (const radialPos of radialRange) {
    const { x, y } = polarToCartesian(radialPos, angle);
    coords.push([x, y, cylinderRange[0]]);
    coords.push([x, y, cylinderRange[1]]);
  }
  return coords;
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
 * Generate the indices for a single face
 * @param {number} baseIndex
 * @returns
 */
function generateFaceIndexes(baseIndex) {
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
 * Generate points on a circle with specified diameter
 * @param {number} diameter - Diameter of the circle (0.0 to 1.0)
 * @returns {Array} Array of {x, y} points in [0, 1] range
 */
function generateCirclePoints(diameter, minTurnAngle = 0, maxTurnAngle = 1) {
  const points = [];
  const radius = diameter / 2;
  const minAngle = minTurnAngle * Math.PI * 2;
  const maxAngle = maxTurnAngle * Math.PI * 2;

  for (let angle = minAngle; angle < maxAngle; angle += CYLINDER_SEGMENT_ANGLE) {
    points.push({
      x: Math.sin(angle) * radius + 0.5,
      y: Math.cos(angle) * radius + 0.5
    });
  }

  points.push({
    x: Math.sin(maxAngle) * radius + 0.5,
    y: Math.cos(maxAngle) * radius + 0.5
  });

  return points;
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