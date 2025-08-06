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
  new Axis('saturation', '%', 100, 50),
  new Axis('value', '%', 100, 75)
], 'saturation'));

/**
 * HSL color space instance
 */
export const HslColorSpace = Object.freeze(new ColorSpace('HSL', [
  new Axis('hue', '°', 360, 180),
  new Axis('saturation', '%', 100, 50),
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
