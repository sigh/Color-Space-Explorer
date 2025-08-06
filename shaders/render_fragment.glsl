precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_colorTexture;
uniform vec2 u_textureSize;
uniform bool u_showBoundaries;

const float EPSILON = 0.003921; // 1/255 for palette index comparison

bool isBoundary(vec2 texCoord, vec2 texelSize) {
  // Sample current pixel and its neighbors
  vec4 center = texture2D(u_colorTexture, texCoord);
  vec4 right = texture2D(u_colorTexture, texCoord + vec2(texelSize.x, 0.0));
  vec4 bottom = texture2D(u_colorTexture, texCoord + vec2(0.0, -texelSize.y));

  // Extract palette indices from alpha channel
  float centerIndex = center.a;
  float rightIndex = right.a;
  float bottomIndex = bottom.a;

  // Check if there's a boundary (different palette colors)
  return (abs(centerIndex - rightIndex) > EPSILON) ||
         (abs(centerIndex - bottomIndex) > EPSILON);
}

void main() {
  vec2 texelSize = 1.0 / u_textureSize;

  // Sample center color for display
  vec4 center = texture2D(u_colorTexture, v_texCoord);

  // Check if we should show boundaries and if we're at a boundary
  bool boundary = u_showBoundaries && isBoundary(v_texCoord, texelSize);

  // If it's a boundary, draw a dark line, otherwise show the original color
  vec3 finalColor = boundary ? vec3(0.0, 0.0, 0.0) : center.rgb;

  gl_FragColor = vec4(finalColor, 1.0);
}
