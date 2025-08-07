#version 300 es
precision mediump float;
out vec4 fragColor;
uniform sampler2D u_colorTexture;
uniform bool u_showBoundaries;

const int MIP_LEVEL = 0;

bool isBoundary(ivec2 pixelCoord, vec4 center) {
  const float EPSILON = 0.001; // Must be less than 1/MAX_PALETTE_COLORS

  // Check left neighbor if not at left edge
  if (pixelCoord.x > 0) {
    vec4 left = texelFetch(u_colorTexture, pixelCoord + ivec2(-1, 0), MIP_LEVEL);
    if (abs(center.a - left.a) > EPSILON) return true;
  }

  // Check bottom neighbor if not at bottom edge
  if (pixelCoord.y > 0) {
    vec4 bottom = texelFetch(u_colorTexture, pixelCoord + ivec2(0, -1), MIP_LEVEL);
    if (abs(center.a - bottom.a) > EPSILON) return true;
  }

  return false;
}

// Get boundary color that contrasts well with the underlying color
vec3 getBoundaryColor(vec3 backgroundColor) {
  // Calculate luminance of the underlying color
  float luminance = dot(backgroundColor, vec3(0.299, 0.587, 0.114));

  // Smooth transition for visual continuity
  float t = smoothstep(0.3, 0.7, luminance);
  return mix(vec3(1.0), vec3(0.0), t);
}

void main() {
  // Use fragment coordinates directly - gl_FragCoord gives us pixel coordinates
  ivec2 pixelCoord = ivec2(gl_FragCoord.xy);

  // Sample center color for display
  vec4 center = texelFetch(u_colorTexture, pixelCoord, MIP_LEVEL);

  // Check if we should show boundaries and if we're at a boundary
  bool boundary = u_showBoundaries && isBoundary(pixelCoord, center);

  // Choose appropriate color based on whether this is a boundary
  vec3 finalColor = boundary ? getBoundaryColor(center.rgb) : center.rgb;

  fragColor = vec4(finalColor, 1.0);
}
