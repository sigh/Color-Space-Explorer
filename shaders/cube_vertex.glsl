#version 300 es
in vec3 a_position;
in vec3 a_colorCoord;

uniform mat4 u_modelViewProjection;

out vec3 v_colorCoord;

void main() {
  gl_Position = u_modelViewProjection * vec4(a_position, 1.0);
  v_colorCoord = a_colorCoord;
}
