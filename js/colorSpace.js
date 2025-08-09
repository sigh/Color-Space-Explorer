/**
 * Represents a single axis in a color space
 */
export class Axis {
  /**
   * @param {string} key - The key name of the axis (e.g., 'hue', 'saturation')
   * @param {string} unit - The unit for the axis (e.g., '°', '%')
   * @param {number} max - Maximum value for the axis
   * @param {number} defaultValue - Default value for the axis
   */
  constructor(key, unit, max, defaultValue) {
    this.key = key;
    this.unit = unit;
    this.max = max;
    this.defaultValue = defaultValue;

    // Min is always 0, name is always the capitalized key
    this.min = 0;
    this.name = key.charAt(0).toUpperCase() + key.slice(1);

    Object.freeze(this);
  }

  /**
   * Check if a value is valid for this axis
   * @param {number} value
   * @returns {boolean}
   */
  isValidValue(value) {
    // Check if value is within the valid range for this axis
    return Number.isInteger(value) && value >= this.min && value <= this.max;
  }
}

/**
 * Immutable color space view - a simple container for current axis and value
 */
export class ColorSpaceView {
  constructor(colorSpace, currentAxis, currentValue, showBoundaries = true) {
    this.colorSpace = colorSpace;
    this.currentAxis = currentAxis;
    this.currentValue = currentValue;
    this.showBoundaries = showBoundaries;

    // Freeze the object to make it immutable
    Object.freeze(this);
  }
}

/**
 * Immutable color space configuration class
 * Contains all the semantic information about a color space
 */
export class ColorSpace {
  /**
   * @param {string} type - The type of color space (e.g., 'HSV', 'HSL')
   * @param {Array<Axis>} axes - Array of Axis objects in order
   * @param {string} defaultAxisKey - Key of the default axis to select
   */
  constructor(type, axes, defaultAxisKey) {
    this._type = type;
    this._axes = Object.freeze([...axes]);
    this._defaultAxis = this.getAxisByKey(defaultAxisKey);

    // Freeze the entire object to make it immutable
    Object.freeze(this);
  }

  /**
   * Get an axis by its key name
   * @param {string} axisKey - The key name of the axis (e.g., 'hue', 'saturation')
   * @returns {Axis} Axis object
   */
  getAxisByKey(axisKey) {
    return this._axes.find(axis => axis.key === axisKey);
  }

  /**
   * Get the index of an axis object
   * @param {Axis} axis - The axis object to find the index for
   * @returns {number} Index of the axis, or -1 if not found
   */
  getAxisIndex(axis) {
    return this._axes.indexOf(axis);
  }

  /**
   * Get all axes
   * @returns {Array<Axis>} Array of axis objects
   */
  getAllAxes() {
    return this._axes;
  }

  /**
   * Get the color space type
   * @returns {string} Color space type
   */
  getType() {
    return this._type;
  }

  /**
   * Get the default axis
   * @returns {Axis} Default axis object
   */
  getDefaultAxis() {
    return this._defaultAxis;
  }
}

/**
 * RGB color space instance
 */
export const RgbColorSpace = Object.freeze(new ColorSpace('RGB', [
  new Axis('red', '%', 100, 50),
  new Axis('green', '%', 100, 50),
  new Axis('blue', '%', 100, 50)
], 'red'));

/**
 * HSV color space instance
 */
export const HsvColorSpace = Object.freeze(new ColorSpace('HSV', [
  new Axis('hue', '°', 360, 180),
  new Axis('saturation', '%', 100, 100),
  new Axis('value', '%', 100, 100)
], 'saturation'));

/**
 * HSL color space instance
 */
export const HslColorSpace = Object.freeze(new ColorSpace('HSL', [
  new Axis('hue', '°', 360, 180),
  new Axis('saturation', '%', 100, 100),
  new Axis('lightness', '%', 100, 50)
], 'saturation'));

/**
 * Get all available color spaces in canonical order
 * @returns {Array<ColorSpace>} Array of all color space instances
 */
export function getAllColorSpaces() {
  return [RgbColorSpace, HsvColorSpace, HslColorSpace];
}

/**
 * Get a color space by type
 * @param {string} type - The type of color space (e.g., 'HSV', 'HSL')
 * @returns {ColorSpace} Color space instance
 */
export function getColorSpaceByType(type) {
  return getAllColorSpaces().find(cs => cs.getType() === type);
}

/**
 * Base color class - not exported
 */
class Color {
  /**
   * @param {...number} coordinates - The coordinate values for each axis in the color space (normalized to 0-1 range)
   * @throws {Error} If the number of coordinates doesn't match the number of axes
   */
  constructor(...coordinates) {
    const colorSpace = this.constructor.colorSpace;
    const expectedAxes = colorSpace.getAllAxes().length;
    if (coordinates.length !== expectedAxes) {
      throw new Error(
        `Color requires ${expectedAxes} coordinates for ${colorSpace.getType()} color space, got ${coordinates.length}`
      );
    }

    // Validate that all coordinates are in the normalized [0, 1] range
    coordinates.forEach((coord, i) => {
      if (coord < 0 || coord > 1) {
        const axisName = colorSpace.getAllAxes()[i].name;
        throw new Error(
          `Coordinate for ${axisName} must be in range [0, 1], got ${coord}`
        );
      }
    });

    this._coordinates = coordinates;
    Object.freeze(this);
  }

  /**
   * Get the color space this color belongs to
   * @returns {ColorSpace} The color space instance
   */
  getColorSpace() {
    return this.constructor.colorSpace;
  }

  /**
   * Make the color iterable over its coordinates
   * @returns {Iterator<number>} Iterator over coordinate values
   */
  *[Symbol.iterator]() {
    yield* this._coordinates;
  }

  /**
   * Returns a string representation of the color in its color space.
   * Example: "RGB: 100% 0% 50%"
   * @returns {string}
   */
  toString() {
    const colorSpace = this.constructor.colorSpace;
    const type = colorSpace.getType();
    const axes = colorSpace.getAllAxes();
    const coords = this._coordinates
      .map((c, i) => `${Math.round(c * axes[i].max)}${axes[i].unit}`)
      .join(' ');
    return `${type}: ${coords}`;
  }
}

/**
 * RGB color with normalized coordinates (0-1 range)
 */
export class RgbColor extends Color {
  static colorSpace = RgbColorSpace;
}

/**
 * HSV color with normalized coordinates (0-1 range)
 */
export class HsvColor extends Color {
  static colorSpace = HsvColorSpace;
}

/**
 * HSL color with normalized coordinates (0-1 range)
 */
export class HslColor extends Color {
  static colorSpace = HslColorSpace;
}