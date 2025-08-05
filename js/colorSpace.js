/**
 * Color space axis enumeration
 */
export const Axis = {
  HUE: 'hue',
  SATURATION: 'saturation',
  VALUE: 'value'
};

/**
 * Immutable color space view - a simple container for current axis and value
 */
export class ColorSpaceView {
  constructor(currentAxis, currentValue) {
    this._currentAxis = currentAxis;
    this._currentValue = currentValue;

    // Freeze the object to make it immutable
    Object.freeze(this);
  }

  /**
   * Get the current fixed axis
   * @returns {string} Current axis
   */
  getCurrentAxis() {
    return this._currentAxis;
  }

  /**
   * Get the current axis value
   * @returns {number} Current value
   */
  getCurrentValue() {
    return this._currentValue;
  }
}

/**
 * Immutable HSV color space configuration object
 * Contains all the semantic information about the HSV color space
 */
export class HsvColorSpace {
  constructor() {
    // Define axis configurations for HSV color space
    this._axisConfigs = Object.freeze({
      [Axis.HUE]: {
        name: 'Hue',
        unit: '°',
        min: 0,
        max: 360,
        defaultValue: 180,
        description: 'Color tone'
      },
      [Axis.SATURATION]: {
        name: 'Saturation',
        unit: '%',
        min: 0,
        max: 100,
        defaultValue: 50,
        description: 'Color intensity'
      },
      [Axis.VALUE]: {
        name: 'Value',
        unit: '%',
        min: 0,
        max: 100,
        defaultValue: 75,
        description: 'Color brightness'
      }
    });

    // Freeze the entire object
    Object.freeze(this);
  }

  /**
   * Get configuration for a specific axis
   * @param {string} axis - Axis to get config for
   * @returns {Object} Axis configuration (frozen)
   */
  getAxisConfig(axis) {
    if (!this._axisConfigs[axis]) {
      throw new Error(`Invalid axis: ${axis}`);
    }
    return Object.freeze({ ...this._axisConfigs[axis] });
  }

  /**
   * Get all axis names
   * @returns {string[]} Array of axis names
   */
  getAxisNames() {
    return Object.keys(this._axisConfigs);
  }

  /**
   * Get display name for an axis
   * @param {string} axis - Axis to get name for
   * @returns {string} Display name
   */
  getAxisDisplayName(axis) {
    const config = this.getAxisConfig(axis);
    return config.name;
  }

  /**
   * Get default value for an axis
   * @param {string} axis - Axis to get default value for
   * @returns {number} Default value
   */
  getDefaultValue(axis) {
    const config = this.getAxisConfig(axis);
    return config.defaultValue;
  }

  /**
   * Get description for an axis
   * @param {string} axis - Axis to get description for
   * @returns {string} Axis description
   */
  getAxisDescription(axis) {
    const config = this.getAxisConfig(axis);
    return config.description;
  }

  /**
   * Check if an axis is valid for this color space
   * @param {string} axis - Axis to validate
   * @returns {boolean} True if valid
   */
  isValidAxis(axis) {
    return axis in this._axisConfigs;
  }
}
