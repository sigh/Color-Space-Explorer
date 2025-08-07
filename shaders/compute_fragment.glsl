#version 300 es
precision mediump float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform float u_fixedValue;
uniform int u_colorSpaceIndex; // 0=RGB, 1=HSV, 2=HSL
uniform int u_axisIndex; // Ordered as the color-space initials.

const int MAX_PALETTE_COLORS = 200;
uniform vec3 u_paletteColors[MAX_PALETTE_COLORS]; // Maximum palette colors
uniform int u_paletteCount;

vec3 hsvToRgb(float h, float s, float v) {
  vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0);
  vec3 p = abs(fract(h + k) * 6.0 - 3.0);
  return v * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), s);
}

vec3 hslToRgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0);
  vec3 p = abs(fract(h + k) * 6.0 - 3.0);
  return l + c * (clamp(p - 1.0, 0.0, 1.0) - 0.5);
}

// Convert RGB to XYZ color space (D65 illuminant)
vec3 rgbToXyz(vec3 rgb) {
  // Reference: http://www.brucelindbloom.com/index.html?Eqn_RGB_to_XYZ.html

  // Apply gamma correction (sRGB to linear RGB)
  vec3 linear = mix(
      rgb / 12.92,
      pow((rgb + 0.055) / 1.055, vec3(2.4)),
      greaterThan(rgb, vec3(0.04045)));

  // Convert to XYZ using sRGB matrix (D65 illuminant)
  // See http://brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
  mat3 rgbToXyzMatrix = mat3(
    0.4124564, 0.3575761, 0.1804375,
    0.2126729, 0.7151522, 0.0721750,
    0.0193339, 0.1191920, 0.9503041
  );

  return rgbToXyzMatrix * linear;
}

// Convert XYZ to LAB color space
vec3 xyzToLab(vec3 xyz) {
  // Reference: http://www.brucelindbloom.com/index.html?Eqn_XYZ_to_Lab.html

  // D65 illuminant reference white point
  // See http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html
  vec3 referenceWhite = vec3(0.95047, 1.00000, 1.08883);

  // Normalize by reference white
  vec3 normalized = xyz / referenceWhite;

  // Apply LAB transformation function
  const float EPSILON = 0.008856;  // epsilon = delta^3 where delta = 6/29
  const float KAPPA = 903.3; // kappa = 24389/27
  vec3 f = mix(
    (KAPPA / 116.0) * normalized + vec3(16.0/116.0),
    pow(normalized, vec3(1.0/3.0)),
    greaterThan(normalized, vec3(EPSILON))
  );

  // Calculate LAB values
  float L = 116.0 * f.y - 16.0;
  float a = 500.0 * (f.x - f.y);
  float b = 200.0 * (f.y - f.z);

  return vec3(L, a, b);
}

// Convert RGB to LAB color space
vec3 rgbToLab(vec3 rgb) {
  vec3 xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

float distance2(vec3 v1, vec3 v2) {
  vec3 diff = v1 - v2;
  return dot(diff, diff);
}

// Returns the index of the closest palette color
int findClosestPaletteIndex(vec3 color) {
  vec3 labColor = rgbToLab(color); // Only convert once
  float minDistance2 = 1000000.0;
  int closestIndex = 0;

  for (int i = 0; i < MAX_PALETTE_COLORS; i++) {
    if (i >= u_paletteCount) break;
    vec3 labPaletteColor = rgbToLab(u_paletteColors[i]);
    float d2 = distance2(labColor, labPaletteColor);
    if (d2 < minDistance2) {
      minDistance2 = d2;
      closestIndex = i;
    }
  }
  return closestIndex;
}

void main() {
  vec3 colorCoord;

  if (u_axisIndex == 0) {
    colorCoord = vec3(u_fixedValue, v_texCoord.x, v_texCoord.y);
  } else if (u_axisIndex == 1) {
    colorCoord = vec3(v_texCoord.x, u_fixedValue, v_texCoord.y);
  } else {
    colorCoord = vec3(v_texCoord.x, v_texCoord.y, u_fixedValue);
  }

  vec3 color;
  if (u_colorSpaceIndex == 0) {
    // RGB color space - colorCoord values are already in RGB range [0,1]
    color = colorCoord;
  } else if (u_colorSpaceIndex == 1) {
    // HSV color space
    color = hsvToRgb(colorCoord.x, colorCoord.y, colorCoord.z);
  } else {
    // HSL color space
    color = hslToRgb(colorCoord.x, colorCoord.y, colorCoord.z);
  }

  // Store closest index as alpha (normalized to 0-1 range)
  int closestIndex = findClosestPaletteIndex(color);
  float alpha = float(closestIndex) / 255.0;

  fragColor = vec4(color, alpha);
}
