#version 300 es
precision mediump float;

in vec3 v_colorCoord;
out vec4 fragColor;

void main() {
  // Use the color coordinates directly as RGB colors
  // The color coordinates are already in the range [0,1] from the cube geometry
  vec3 color = clamp(v_colorCoord, 0.0, 1.0);
  fragColor = vec4(color, 1.0);
}
