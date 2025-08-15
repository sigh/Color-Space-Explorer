#version 300 es
precision mediump float;
out vec4 fragColor;
uniform sampler2D u_colorTexture;
uniform bool u_showBoundaries;
uniform int u_highlightPaletteIndex; // Index of palette color to highlight (-1 = no highlight)
uniform int u_highlightMode; // Index into getAllHighlightModes array (0 = dim-other, 1 = hide-other, 2 = boundary)

const int MIP_LEVEL = 0;
const int OUTSIDE_COLOR_SPACE = 255;

// Convert float palette index (stored in alpha channel) to int
int getPaletteIndex(float paletteIndexFloat) {
  return int(paletteIndexFloat * 255.0 + 0.5); // Round to nearest int
}

int boundaryPaletteIndex(ivec2 pixelCoord, int centerPaletteIndex) {
  // Check left neighbor if not at left edge
  if (pixelCoord.x > 0) {
    vec4 left = texelFetch(u_colorTexture, pixelCoord + ivec2(-1, 0), MIP_LEVEL);
    int paletteIndex = getPaletteIndex(left.a);
    if (paletteIndex != centerPaletteIndex && paletteIndex != OUTSIDE_COLOR_SPACE) {
      return paletteIndex;
    }
  }

  // Check bottom neighbor if not at bottom edge
  if (pixelCoord.y > 0) {
    vec4 bottom = texelFetch(u_colorTexture, pixelCoord + ivec2(0, -1), MIP_LEVEL);
    int paletteIndex = getPaletteIndex(bottom.a);
    if (paletteIndex != centerPaletteIndex && paletteIndex != OUTSIDE_COLOR_SPACE) {
      return paletteIndex;
    }
  }

  return -1;
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
    if (u_highlightMode == 0) {
      // Dim-other mode: reduce brightness of non-highlighted regions
      return baseColor * 0.4;
    }
  }

  return baseColor;
}

// Check if we should show a boundary here.
bool showBoundary(ivec2 pixelCoord, int paletteIndex) {
  // Don't show boundaries when we are hiding other regions.
  if (u_highlightMode == 1 && u_highlightPaletteIndex >= 0) return false;

  // Check if we are a boundary.
  int boundaryIndex = boundaryPaletteIndex(pixelCoord, paletteIndex);
  bool isBoundary = boundaryIndex >= 0;

  bool showBoundary = false;
  if (u_highlightMode == 2 && u_highlightPaletteIndex >= 0) {
    // Boundary mode: only show boundaries between highlighted and non-highlighted regions
    showBoundary = isBoundary && (boundaryIndex == u_highlightPaletteIndex || paletteIndex == u_highlightPaletteIndex);
  } else if (u_showBoundaries) {
    // Normal modes: show all boundaries
    showBoundary = isBoundary;
  }

  return showBoundary;
}

void main() {
  // Use fragment coordinates directly - gl_FragCoord gives us pixel coordinates
  ivec2 pixelCoord = ivec2(gl_FragCoord.xy);

  // Sample center color data
  vec4 center = texelFetch(u_colorTexture, pixelCoord, MIP_LEVEL);

  // Split out color and palette index
  vec3 baseColor = center.rgb;
  int paletteIndex = getPaletteIndex(center.a);

  // Check if this is an invalid coordinate first
  if (paletteIndex == OUTSIDE_COLOR_SPACE) {
    fragColor = vec4(0.0, 0.0, 0.0, 0.0); // Fully transparent for invalid coordinates
    return;
  }

  // Check if we should hide this pixel (hide-other mode)
  if (u_highlightMode == 1 && u_highlightPaletteIndex >= 0 && paletteIndex != u_highlightPaletteIndex) {
    fragColor = vec4(0.0, 0.0, 0.0, 0.0); // Fully transparent for hidden regions
    return;
  }

  // Apply highlighting first (but not on boundaries)
  vec3 colorWithHighlight = applyHighlighting(baseColor, paletteIndex);

  // Choose final color: boundary overrides highlighting
  vec3 finalColor = showBoundary(pixelCoord, paletteIndex)
      ? getBoundaryColor(baseColor) : colorWithHighlight;

  fragColor = vec4(finalColor, 1.0);
}
