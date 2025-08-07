#version 300 es
precision mediump float;
out vec4 fragColor;
uniform sampler2D u_colorTexture;
uniform bool u_showBoundaries;

const float EPSILON = 0.003921;
const int MIP_LEVEL = 0;

bool isBoundary(ivec2 pixelCoord, vec4 center) {
  // Sample neighbors using texelFetch
  vec4 right = texelFetch(u_colorTexture, pixelCoord + ivec2(1, 0), MIP_LEVEL);
  vec4 bottom = texelFetch(u_colorTexture, pixelCoord + ivec2(0, -1), MIP_LEVEL);

  // Check if there's a boundary (different palette colors)
  return (abs(center.a - right.a) > EPSILON) ||
         (abs(center.a - bottom.a) > EPSILON);
}

void main() {
  // Use fragment coordinates directly - gl_FragCoord gives us pixel coordinates
  ivec2 pixelCoord = ivec2(gl_FragCoord.xy);

  // Sample center color for display
  vec4 center = texelFetch(u_colorTexture, pixelCoord, MIP_LEVEL);

  // Check if we should show boundaries and if we're at a boundary
  bool boundary = u_showBoundaries && isBoundary(pixelCoord, center);

  // If it's a boundary, draw a dark line, otherwise show the original color
  vec3 finalColor = boundary ? vec3(0.0) : center.rgb;

  fragColor = vec4(finalColor, 1.0);
}
