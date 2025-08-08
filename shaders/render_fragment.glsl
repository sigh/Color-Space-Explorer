#version 300 es
precision mediump float;
out vec4 fragColor;
uniform sampler2D u_colorTexture;
uniform bool u_showBoundaries;
uniform int u_highlightPaletteIndex; // Index of palette color to highlight (-1 = no highlight)

const int MIP_LEVEL = 0;

// Convert float palette index (stored in alpha channel) to int
int getPaletteIndex(float paletteIndexFloat) {
  return int(paletteIndexFloat * 255.0 + 0.5); // Round to nearest int
}

bool isBoundary(ivec2 pixelCoord, vec3 centerColor, int centerPaletteIndex) {
  // Check left neighbor if not at left edge
  if (pixelCoord.x > 0) {
    vec4 left = texelFetch(u_colorTexture, pixelCoord + ivec2(-1, 0), MIP_LEVEL);
    if (centerPaletteIndex != getPaletteIndex(left.a)) return true;
  }

  // Check bottom neighbor if not at bottom edge
  if (pixelCoord.y > 0) {
    vec4 bottom = texelFetch(u_colorTexture, pixelCoord + ivec2(0, -1), MIP_LEVEL);
    if (centerPaletteIndex != getPaletteIndex(bottom.a)) return true;
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

// Apply highlighting effect to a color based on palette index
vec3 applyHighlighting(vec3 baseColor, int paletteIndex) {
  if (u_highlightPaletteIndex >= 0 && paletteIndex != u_highlightPaletteIndex) {
    // Dim non-highlighted regions
    return baseColor * 0.4;
  }

  return baseColor;
}

void main() {
  // Use fragment coordinates directly - gl_FragCoord gives us pixel coordinates
  ivec2 pixelCoord = ivec2(gl_FragCoord.xy);

  // Sample center color data
  vec4 center = texelFetch(u_colorTexture, pixelCoord, MIP_LEVEL);

  // Split out color and palette index
  vec3 baseColor = center.rgb;
  int paletteIndex = getPaletteIndex(center.a);

  // Apply highlighting first (but not on boundaries)
  vec3 colorWithHighlight = applyHighlighting(baseColor, paletteIndex);

  // Check if we should show boundaries and if we're at a boundary
  bool boundary = u_showBoundaries && isBoundary(pixelCoord, baseColor, paletteIndex);

  // Choose final color: boundary overrides highlighting
  vec3 finalColor = boundary ? getBoundaryColor(baseColor) : colorWithHighlight;

  fragColor = vec4(finalColor, 1.0);
}
