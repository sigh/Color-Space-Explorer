precision mediump float;
varying vec2 v_texCoord;
uniform float u_fixedValue;
uniform int u_colorSpaceIndex; // 0=HSV, 1=HSL
uniform int u_axisIndex; // Ordered as the color-space initials.

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

  gl_FragColor = vec4(color, 1.0);
}
