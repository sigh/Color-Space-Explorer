precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_colorTexture;

void main() {
  gl_FragColor = vec4(texture2D(u_colorTexture, v_texCoord).rgb, 1.0);
}
