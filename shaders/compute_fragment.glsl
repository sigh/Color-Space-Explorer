precision mediump float;
varying vec2 v_texCoord;
uniform float u_fixedValue;
uniform int u_colorSpaceIndex; // 0=HSV, 1=HSL
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

// Calculate RGB distance squared (more efficient)
float rgbDistanceSquared(vec3 color1, vec3 color2) {
  vec3 diff = color1 - color2;
  return dot(diff, diff);
}

// Returns the index of the closest palette color
int findClosestPaletteIndex(vec3 color) {
  float minDistance = 1000000.0;
  int closestIndex = 0;

  for (int i = 0; i < MAX_PALETTE_COLORS; i++) {
    if (i >= u_paletteCount) break;
    float distance = rgbDistanceSquared(color, u_paletteColors[i]);
    if (distance < minDistance) {
      minDistance = distance;
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
    color = hsvToRgb(colorCoord.x, colorCoord.y, colorCoord.z);
  } else {
    color = hslToRgb(colorCoord.x, colorCoord.y, colorCoord.z);
  }

  // Store closest index as alpha (normalized to 0-1 range)
  int closestIndex = findClosestPaletteIndex(color);
  float alpha = float(closestIndex) / 255.0;

  gl_FragColor = vec4(color, alpha);
}
