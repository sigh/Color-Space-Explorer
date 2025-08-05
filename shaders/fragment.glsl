precision mediump float;
varying vec2 v_texCoord;
uniform float u_fixedValue;
uniform float u_axisMode; // 0.0=hue, 1.0=saturation, 2.0=value

vec3 hsvToRgb(float h, float s, float v) {
  vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0);
  vec3 p = abs(fract(h/360.0 + k) * 6.0 - 3.0);
  return v * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), s);
}

void main() {
  float h, s, v;

  if (u_axisMode < 0.5) {
    // Fixed hue: x=saturation, y=value
    h = u_fixedValue;
    s = v_texCoord.x;
    v = v_texCoord.y;
  } else if (u_axisMode < 1.5) {
    // Fixed saturation: x=hue, y=value
    h = v_texCoord.x * 360.0;
    s = u_fixedValue / 100.0;
    v = v_texCoord.y;
  } else {
    // Fixed value: x=hue, y=saturation
    h = v_texCoord.x * 360.0;
    s = v_texCoord.y;
    v = u_fixedValue / 100.0;
  }

  vec3 color = hsvToRgb(h, s, v);
  gl_FragColor = vec4(color, 1.0);
}
