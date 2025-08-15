#version 300 es
precision mediump float;
out vec4 fragColor;

uniform sampler2D u_depthTexture;

void main() {
  // Get current fragment's screen coordinates (already normalized by WebGL)
  vec2 screenCoord = gl_FragCoord.xy / vec2(textureSize(u_depthTexture, 0));

  // Sample the depth buffer at this location
  float existingDepth = texture(u_depthTexture, screenCoord).r;

  // Get current fragment's depth (in same range as depth buffer)
  float currentDepth = gl_FragCoord.z;

  // Only render if we're at or in front of the existing depth
  // Add small epsilon to avoid z-fighting
  const float epsilon = 0.0001;
  if (currentDepth > existingDepth + epsilon) {
    discard;
  }

  fragColor = vec4(1.0, 1.0, 1.0, 0.1); // White with some transparency
}
