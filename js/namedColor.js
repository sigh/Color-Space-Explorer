import { RgbColor } from './colorSpace.js';

/**
 * Represents a single color in the palette
 */
export class NamedColor {
  constructor(name, rgbColor) {
    this.name = name;
    this.rgbColor = rgbColor;
    Object.freeze(this);
  }
}

/**
 * Get all available preset names
 * @returns {Array<string>} Array of preset names
 */
export function getPresetNames() {
  return Object.keys(ColorPresets);
}

/**
 * Get a preset by name
 * @param {string} presetName - Name of the preset
 * @returns {Array<NamedColor>} Array of palette colors
 */
export function getPreset(presetName) {
  return ColorPresets[presetName] || [];
}

/**
 * Convert hex color string to RgbColor instance
 * @param {string} hex - Hex color string (e.g., '#FF0000')
 * @returns {RgbColor} RGB color instance
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new RgbColor(r, g, b);
}

/**
 * Predefined color palette presets
 */
const ColorPresets = {
  // Basic colors from W3C CSS Color Module Level 3 specification:
  // https://www.w3.org/TR/css-color-3/#html4
  'Basic Web Colors': [
    new NamedColor('Black', hexToRgb('#000000')),
    new NamedColor('Silver', hexToRgb('#C0C0C0')),
    new NamedColor('Gray', hexToRgb('#808080')),
    new NamedColor('White', hexToRgb('#FFFFFF')),
    new NamedColor('Maroon', hexToRgb('#800000')),
    new NamedColor('Red', hexToRgb('#FF0000')),
    new NamedColor('Purple', hexToRgb('#800080')),
    new NamedColor('Fuchsia', hexToRgb('#FF00FF')),
    new NamedColor('Green', hexToRgb('#008000')),
    new NamedColor('Lime', hexToRgb('#00FF00')),
    new NamedColor('Olive', hexToRgb('#808000')),
    new NamedColor('Yellow', hexToRgb('#FFFF00')),
    new NamedColor('Navy', hexToRgb('#000080')),
    new NamedColor('Blue', hexToRgb('#0000FF')),
    new NamedColor('Teal', hexToRgb('#008080')),
    new NamedColor('Aqua', hexToRgb('#00FFFF'))
  ],

  // Extended colors from W3C CSS Color Module Level 3 specification:
  // https://www.w3.org/TR/css-color-3/#svg-color
  'CSS Colors': [
    new NamedColor('AliceBlue', hexToRgb('#F0F8FF')),
    new NamedColor('AntiqueWhite', hexToRgb('#FAEBD7')),
    new NamedColor('Aquamarine', hexToRgb('#7FFFD4')),
    new NamedColor('Azure', hexToRgb('#F0FFFF')),
    new NamedColor('Beige', hexToRgb('#F5F5DC')),
    new NamedColor('Bisque', hexToRgb('#FFE4C4')),
    new NamedColor('Black', hexToRgb('#000000')),
    new NamedColor('BlanchedAlmond', hexToRgb('#FFEBCD')),
    new NamedColor('Blue', hexToRgb('#0000FF')),
    new NamedColor('BlueViolet', hexToRgb('#8A2BE2')),
    new NamedColor('Brown', hexToRgb('#A52A2A')),
    new NamedColor('BurlyWood', hexToRgb('#DEB887')),
    new NamedColor('CadetBlue', hexToRgb('#5F9EA0')),
    new NamedColor('Chartreuse', hexToRgb('#7FFF00')),
    new NamedColor('Chocolate', hexToRgb('#D2691E')),
    new NamedColor('Coral', hexToRgb('#FF7F50')),
    new NamedColor('CornflowerBlue', hexToRgb('#6495ED')),
    new NamedColor('Cornsilk', hexToRgb('#FFF8DC')),
    new NamedColor('Crimson', hexToRgb('#DC143C')),
    new NamedColor('Cyan', hexToRgb('#00FFFF')),
    new NamedColor('DarkBlue', hexToRgb('#00008B')),
    new NamedColor('DarkCyan', hexToRgb('#008B8B')),
    new NamedColor('DarkGoldenRod', hexToRgb('#B8860B')),
    new NamedColor('DarkGray', hexToRgb('#A9A9A9')),
    new NamedColor('DarkGreen', hexToRgb('#006400')),
    new NamedColor('DarkKhaki', hexToRgb('#BDB76B')),
    new NamedColor('DarkMagenta', hexToRgb('#8B008B')),
    new NamedColor('DarkOliveGreen', hexToRgb('#556B2F')),
    new NamedColor('DarkOrange', hexToRgb('#FF8C00')),
    new NamedColor('DarkOrchid', hexToRgb('#9932CC')),
    new NamedColor('DarkRed', hexToRgb('#8B0000')),
    new NamedColor('DarkSalmon', hexToRgb('#E9967A')),
    new NamedColor('DarkSeaGreen', hexToRgb('#8FBC8F')),
    new NamedColor('DarkSlateBlue', hexToRgb('#483D8B')),
    new NamedColor('DarkSlateGray', hexToRgb('#2F4F4F')),
    new NamedColor('DarkTurquoise', hexToRgb('#00CED1')),
    new NamedColor('DarkViolet', hexToRgb('#9400D3')),
    new NamedColor('DeepPink', hexToRgb('#FF1493')),
    new NamedColor('DeepSkyBlue', hexToRgb('#00BFFF')),
    new NamedColor('DimGray', hexToRgb('#696969')),
    new NamedColor('DodgerBlue', hexToRgb('#1E90FF')),
    new NamedColor('FireBrick', hexToRgb('#B22222')),
    new NamedColor('FloralWhite', hexToRgb('#FFFAF0')),
    new NamedColor('ForestGreen', hexToRgb('#228B22')),
    new NamedColor('Gainsboro', hexToRgb('#DCDCDC')),
    new NamedColor('GhostWhite', hexToRgb('#F8F8FF')),
    new NamedColor('Gold', hexToRgb('#FFD700')),
    new NamedColor('GoldenRod', hexToRgb('#DAA520')),
    new NamedColor('Gray', hexToRgb('#808080')),
    new NamedColor('Green', hexToRgb('#008000')),
    new NamedColor('GreenYellow', hexToRgb('#ADFF2F')),
    new NamedColor('HoneyDew', hexToRgb('#F0FFF0')),
    new NamedColor('HotPink', hexToRgb('#FF69B4')),
    new NamedColor('IndianRed', hexToRgb('#CD5C5C')),
    new NamedColor('Indigo', hexToRgb('#4B0082')),
    new NamedColor('Ivory', hexToRgb('#FFFFF0')),
    new NamedColor('Khaki', hexToRgb('#F0E68C')),
    new NamedColor('Lavender', hexToRgb('#E6E6FA')),
    new NamedColor('LavenderBlush', hexToRgb('#FFF0F5')),
    new NamedColor('LawnGreen', hexToRgb('#7CFC00')),
    new NamedColor('LemonChiffon', hexToRgb('#FFFACD')),
    new NamedColor('LightBlue', hexToRgb('#ADD8E6')),
    new NamedColor('LightCoral', hexToRgb('#F08080')),
    new NamedColor('LightCyan', hexToRgb('#E0FFFF')),
    new NamedColor('LightGoldenRodYellow', hexToRgb('#FAFAD2')),
    new NamedColor('LightGray', hexToRgb('#D3D3D3')),
    new NamedColor('LightGreen', hexToRgb('#90EE90')),
    new NamedColor('LightPink', hexToRgb('#FFB6C1')),
    new NamedColor('LightSalmon', hexToRgb('#FFA07A')),
    new NamedColor('LightSeaGreen', hexToRgb('#20B2AA')),
    new NamedColor('LightSkyBlue', hexToRgb('#87CEFA')),
    new NamedColor('LightSlateGray', hexToRgb('#778899')),
    new NamedColor('LightSteelBlue', hexToRgb('#B0C4DE')),
    new NamedColor('LightYellow', hexToRgb('#FFFFE0')),
    new NamedColor('Lime', hexToRgb('#00FF00')),
    new NamedColor('LimeGreen', hexToRgb('#32CD32')),
    new NamedColor('Linen', hexToRgb('#FAF0E6')),
    new NamedColor('Magenta', hexToRgb('#FF00FF')),
    new NamedColor('Maroon', hexToRgb('#800000')),
    new NamedColor('MediumAquaMarine', hexToRgb('#66CDAA')),
    new NamedColor('MediumBlue', hexToRgb('#0000CD')),
    new NamedColor('MediumOrchid', hexToRgb('#BA55D3')),
    new NamedColor('MediumPurple', hexToRgb('#9370DB')),
    new NamedColor('MediumSeaGreen', hexToRgb('#3CB371')),
    new NamedColor('MediumSlateBlue', hexToRgb('#7B68EE')),
    new NamedColor('MediumSpringGreen', hexToRgb('#00FA9A')),
    new NamedColor('MediumTurquoise', hexToRgb('#48D1CC')),
    new NamedColor('MediumVioletRed', hexToRgb('#C71585')),
    new NamedColor('MidnightBlue', hexToRgb('#191970')),
    new NamedColor('MintCream', hexToRgb('#F5FFFA')),
    new NamedColor('MistyRose', hexToRgb('#FFE4E1')),
    new NamedColor('Moccasin', hexToRgb('#FFE4B5')),
    new NamedColor('NavajoWhite', hexToRgb('#FFDEAD')),
    new NamedColor('Navy', hexToRgb('#000080')),
    new NamedColor('OldLace', hexToRgb('#FDF5E6')),
    new NamedColor('Olive', hexToRgb('#808000')),
    new NamedColor('OliveDrab', hexToRgb('#6B8E23')),
    new NamedColor('Orange', hexToRgb('#FFA500')),
    new NamedColor('OrangeRed', hexToRgb('#FF4500')),
    new NamedColor('Orchid', hexToRgb('#DA70D6')),
    new NamedColor('PaleGoldenRod', hexToRgb('#EEE8AA')),
    new NamedColor('PaleGreen', hexToRgb('#98FB98')),
    new NamedColor('PaleTurquoise', hexToRgb('#AFEEEE')),
    new NamedColor('PaleVioletRed', hexToRgb('#DB7093')),
    new NamedColor('PapayaWhip', hexToRgb('#FFEFD5')),
    new NamedColor('PeachPuff', hexToRgb('#FFDAB9')),
    new NamedColor('Peru', hexToRgb('#CD853F')),
    new NamedColor('Pink', hexToRgb('#FFC0CB')),
    new NamedColor('Plum', hexToRgb('#DDA0DD')),
    new NamedColor('PowderBlue', hexToRgb('#B0E0E6')),
    new NamedColor('Purple', hexToRgb('#800080')),
    new NamedColor('Red', hexToRgb('#FF0000')),
    new NamedColor('RosyBrown', hexToRgb('#BC8F8F')),
    new NamedColor('RoyalBlue', hexToRgb('#4169E1')),
    new NamedColor('SaddleBrown', hexToRgb('#8B4513')),
    new NamedColor('Salmon', hexToRgb('#FA8072')),
    new NamedColor('SandyBrown', hexToRgb('#F4A460')),
    new NamedColor('SeaGreen', hexToRgb('#2E8B57')),
    new NamedColor('SeaShell', hexToRgb('#FFF5EE')),
    new NamedColor('Sienna', hexToRgb('#A0522D')),
    new NamedColor('Silver', hexToRgb('#C0C0C0')),
    new NamedColor('SkyBlue', hexToRgb('#87CEEB')),
    new NamedColor('SlateBlue', hexToRgb('#6A5ACD')),
    new NamedColor('SlateGray', hexToRgb('#708090')),
    new NamedColor('Snow', hexToRgb('#FFFAFA')),
    new NamedColor('SpringGreen', hexToRgb('#00FF7F')),
    new NamedColor('SteelBlue', hexToRgb('#4682B4')),
    new NamedColor('Tan', hexToRgb('#D2B48C')),
    new NamedColor('Teal', hexToRgb('#008080')),
    new NamedColor('Thistle', hexToRgb('#D8BFD8')),
    new NamedColor('Tomato', hexToRgb('#FF6347')),
    new NamedColor('Turquoise', hexToRgb('#40E0D0')),
    new NamedColor('Violet', hexToRgb('#EE82EE')),
    new NamedColor('Wheat', hexToRgb('#F5DEB3')),
    new NamedColor('White', hexToRgb('#FFFFFF')),
    new NamedColor('WhiteSmoke', hexToRgb('#F5F5F5')),
    new NamedColor('Yellow', hexToRgb('#FFFF00')),
    new NamedColor('YellowGreen', hexToRgb('#9ACD32'))
  ],

  'RGB Vertex Colors': [
    new NamedColor('Red', hexToRgb('#FF0000')),
    new NamedColor('Green', hexToRgb('#00FF00')),
    new NamedColor('Blue', hexToRgb('#0000FF')),
    new NamedColor('Yellow', hexToRgb('#FFFF00')),
    new NamedColor('Cyan', hexToRgb('#00FFFF')),
    new NamedColor('Magenta', hexToRgb('#FF00FF')),
    new NamedColor('White', hexToRgb('#FFFFFF')),
    new NamedColor('Black', hexToRgb('#000000'))
  ],
};