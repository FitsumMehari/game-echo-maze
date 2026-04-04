/** WebGL2 GLSL 300 es — expanding ring echo reveal (#version prepended by Three.js when glslVersion is GLSL3) */
export const worldVertexShader = /* glsl */ `precision highp float;

in vec3 position;
in vec3 normal;
in float cellKind;
in float echoAbsorption;
in vec3 echoDecoyShift;
in float echoDecoy;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out vec3 vNormal;
out vec3 vWorldPos;
out float vCellKind;
out float vAbsorption;
out vec3 vDecoyShift;
out float vDecoy;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(normalMatrix * normal);
  vCellKind = cellKind;
  vAbsorption = echoAbsorption;
  vDecoyShift = echoDecoyShift;
  vDecoy = echoDecoy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const worldFragmentShader = /* glsl */ `precision highp float;

uniform float uTime;
uniform vec3 uCameraPos;
uniform int uPulseCount;
uniform vec3 uPulseOrigin[8];
uniform float uPulseStart[8];
uniform float uPulseSpeed[8];
uniform float uPulseStrength[8];
uniform float uPulseDecay[8];

in vec3 vNormal;
in vec3 vWorldPos;
in float vCellKind;
in float vAbsorption;
in vec3 vDecoyShift;
in float vDecoy;

out vec4 fragColor;

vec3 albedoForCell(float k) {
  if (k > 11.9) return vec3(0.72, 0.56, 0.18);
  if (k > 10.9) return vec3(0.42, 0.22, 0.52);
  if (k > 9.9) return vec3(0.12, 0.55, 0.72);
  if (k > 8.9) return vec3(0.55, 0.12, 0.18);
  if (k < 0.5) return vec3(0.12, 0.12, 0.14);
  if (k < 1.5) return vec3(0.32, 0.35, 0.4);
  if (k < 2.5) return vec3(0.22, 0.28, 0.26);
  if (k < 3.5) return vec3(0.38, 0.34, 0.42);
  if (k < 4.5) return vec3(0.45, 0.15, 0.12);
  if (k < 5.5) return vec3(0.28, 0.42, 0.35);
  if (k < 6.5) return vec3(0.25, 0.22, 0.2);
  if (k < 7.5) return vec3(0.15, 0.55, 0.35);
  return vec3(0.18, 0.18, 0.2);
}

float pulseRing(vec3 samplePos, int i) {
  float t = uTime - uPulseStart[i];
  if (t < 0.0 || t > 10.0) return 0.0;
  float dist = length(samplePos - uPulseOrigin[i]);
  float wave = uPulseSpeed[i] * t;
  float w = 0.55;
  float ring = 1.0 - smoothstep(0.0, w, abs(dist - wave));
  float atten = exp(-uPulseDecay[i] * t);
  return ring * atten * uPulseStrength[i];
}

void main() {
  float liePulse = sin(uTime * 2.85 + dot(vWorldPos.xz, vec2(3.7, 4.2))) * 0.2;
  vec3 lieShift = vDecoyShift * (1.0 + liePulse);
  vec3 echoPos = mix(vWorldPos, vWorldPos + lieShift, step(0.5, vDecoy));
  // Baseline + nearby geometry read (moonlit void); pulses still dominate reveal.
  float distCam = length(vWorldPos - uCameraPos);
  float proximityVis = 0.11 * exp(-distCam * 0.024);
  float vis = 0.1 + proximityVis;
  for (int i = 0; i < 8; i++) {
    float mask = 1.0 - step(float(uPulseCount), float(i));
    float add = pulseRing(echoPos, i) * mask;
    vis += add * vAbsorption;
  }
  vis = clamp(vis, 0.0, 2.5);

  vec3 base = albedoForCell(vCellKind);
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(0.35, 1.0, 0.25));
  float ndotl = max(dot(N, L), 0.0);
  vec3 voidCol = vec3(0.038, 0.045, 0.065);
  vec3 rim = vec3(0.35, 0.75, 1.0) * pow(1.0 - max(dot(normalize(vWorldPos - uCameraPos), N), 0.0), 3.0);

  vec3 lit = base * (0.09 + ndotl * 0.88);
  lit += rim * smoothstep(0.15, 0.75, vis) * 0.35;

  if (vCellKind > 3.5 && vCellKind < 4.5) {
    lit += vec3(1.0, 0.15, 0.08) * smoothstep(0.25, 0.9, vis) * 0.55;
  }
  if (vCellKind > 6.5 && vCellKind < 7.5) {
    lit += vec3(0.2, 1.0, 0.45) * smoothstep(0.2, 0.85, vis) * 0.45;
  }
  if (vCellKind > 8.9 && vCellKind < 9.5) {
    lit += vec3(1.0, 0.25, 0.3) * smoothstep(0.12, 0.75, vis) * 0.65;
  }
  if (vCellKind > 9.9 && vCellKind < 10.5) {
    lit += vec3(0.2, 0.85, 1.0) * smoothstep(0.1, 0.7, vis) * 0.55;
  }
  if (vCellKind > 10.9 && vCellKind < 11.5) {
    lit += vec3(0.85, 0.45, 1.0) * smoothstep(0.15, 0.75, vis) * 0.52;
  }
  if (vCellKind > 11.9) {
    lit += vec3(1.0, 0.82, 0.35) * smoothstep(0.12, 0.8, vis) * 0.55;
  }

  float reveal = smoothstep(0.02, 0.72, vis);
  vec3 outRgb = mix(voidCol, lit + rim * 0.1, reveal);

  fragColor = vec4(outRgb, 1.0);
}
`;
