/**
 * Represents a single color in the palette
 */
export class PaletteColor {
  constructor(name, rgb) {
    this.name = name;
    this.rgb = rgb; // {r, g, b} values from 0-1
    Object.freeze(this);
  }
}
