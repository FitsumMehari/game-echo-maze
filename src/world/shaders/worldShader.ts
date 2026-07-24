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
uniform float uThemeMode;
uniform float uVisualAssist;
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

vec3 tint(vec3 abyss, vec3 neon, vec3 ember, vec3 contrast) {
  vec3 a = mix(abyss, neon, step(0.5, uThemeMode));
  vec3 b = mix(ember, contrast, step(2.5, uThemeMode));
  return mix(a, b, step(1.5, uThemeMode));
}

vec3 albedoForCell(float k) {
  if (k > 13.9) return tint(vec3(0.25,0.95,0.75), vec3(0.9,0.95,0.2), vec3(1.0,0.7,0.2), vec3(1.0));
  // Hide niche — cool memory green (Perception landmark)
  if (k > 12.9) return tint(vec3(0.28,0.62,0.55), vec3(0.25,0.85,0.75), vec3(0.5,0.4,0.22), vec3(0.45,0.95,0.6));
  // Key / checkpoint gold
  if (k > 11.9) return tint(vec3(0.85,0.62,0.18), vec3(0.95,0.9,0.25), vec3(1.0,0.65,0.2), vec3(1.0,1.0,0.3));
  // Ringwell
  if (k > 10.9) return tint(vec3(0.35,0.45,0.85), vec3(0.35,0.7,1.0), vec3(0.55,0.35,0.55), vec3(0.55,0.75,1.0));
  if (k > 9.9) return tint(vec3(0.12,0.55,0.72), vec3(0.1,0.9,1.0), vec3(0.35,0.55,0.9), vec3(0.3,0.9,1.0));
  if (k > 8.9) return tint(vec3(0.55,0.12,0.18), vec3(1.0,0.15,0.45), vec3(1.0,0.18,0.08), vec3(1.0,0.2,0.2));
  if (k < 0.5) return tint(vec3(0.12,0.12,0.14), vec3(0.08,0.12,0.18), vec3(0.14,0.1,0.08), vec3(0.58));
  if (k < 1.5) return tint(vec3(0.32,0.35,0.4), vec3(0.22,0.24,0.38), vec3(0.32,0.22,0.18), vec3(0.92));
  if (k < 2.5) return tint(vec3(0.22,0.28,0.26), vec3(0.12,0.32,0.28), vec3(0.25,0.18,0.12), vec3(0.65));
  if (k < 3.5) return tint(vec3(0.38,0.34,0.42), vec3(0.42,0.18,0.48), vec3(0.45,0.22,0.12), vec3(0.75));
  if (k < 4.5) return tint(vec3(0.45,0.15,0.12), vec3(0.95,0.12,0.45), vec3(1.0,0.12,0.02), vec3(1.0,0.12,0.12));
  if (k < 5.5) return tint(vec3(0.28,0.42,0.35), vec3(0.1,0.9,0.55), vec3(0.6,0.4,0.18), vec3(0.25,1.0,0.35));
  if (k < 6.5) return tint(vec3(0.25,0.22,0.2), vec3(0.42,0.18,0.72), vec3(0.25,0.13,0.07), vec3(0.85));
  // Exit — Perception memory green
  if (k < 7.5) return tint(vec3(0.2,0.75,0.45), vec3(0.15,1.0,0.8), vec3(0.95,0.6,0.15), vec3(0.35,1.0,0.55));
  return tint(vec3(0.18), vec3(0.12,0.14,0.22), vec3(0.16,0.12,0.1), vec3(0.72));
}

float pulseRing(vec3 samplePos, int i) {
  float t = uTime - uPulseStart[i];
  if (t < 0.0 || t > 10.0) return 0.0;
  float dist = length(samplePos - uPulseOrigin[i]);
  float wave = uPulseSpeed[i] * t;
  float ring = 1.0 - smoothstep(0.0, 0.28, abs(dist - wave));
  float wake = exp(-max(0.0, dist - wave) * 1.8) * 0.22;
  return (ring + wake) * exp(-uPulseDecay[i] * t) * uPulseStrength[i];
}

void main() {
  float liePulse = sin(uTime * 2.85 + dot(vWorldPos.xz, vec2(3.7, 4.2))) * 0.2;
  vec3 echoPos = mix(vWorldPos, vWorldPos + vDecoyShift * (1.0 + liePulse), step(0.5, vDecoy));
  float distCam = length(vWorldPos - uCameraPos);
  float proximityVis = (0.11 + uVisualAssist * 0.12) * exp(-distCam * (0.024 - uVisualAssist * 0.01));
  float vis = 0.08 + uVisualAssist * 0.07 + proximityVis;
  for (int i = 0; i < 8; i++) {
    float mask = 1.0 - step(float(uPulseCount), float(i));
    vis += pulseRing(echoPos, i) * mask * vAbsorption;
  }
  vis = clamp(vis, 0.0, 2.7);

  vec3 base = albedoForCell(vCellKind);
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(0.35, 1.0, 0.25));
  float ndotl = max(dot(N, L), 0.0);
  vec3 voidCol = tint(vec3(0.02,0.025,0.04), vec3(0.01,0.02,0.045), vec3(0.04,0.018,0.01), vec3(0.005));
  // Perception-style ghostly cyan rim + Stifled white ring outline feel
  vec3 rimCol = tint(vec3(0.55,0.85,1.0), vec3(0.35,1.0,1.0), vec3(1.0,0.55,0.22), vec3(1.0));
  vec3 edgeCol = tint(vec3(0.85,0.95,1.0), vec3(0.7,1.0,1.0), vec3(1.0,0.8,0.55), vec3(1.0));
  float rimMask = pow(1.0 - max(dot(normalize(uCameraPos - vWorldPos), N), 0.0), 2.6);
  vec3 lit = base * (0.07 + ndotl * 0.9) + rimCol * rimMask * smoothstep(0.12, 0.8, vis) * 0.42;
  lit += edgeCol * rimMask * rimMask * smoothstep(0.35, 1.1, vis) * 0.28;

  if (vCellKind > 3.5 && vCellKind < 4.5) lit += tint(vec3(1,0.15,0.08), vec3(1,0.05,0.6), vec3(1,0.08,0.02), vec3(1,0,0)) * smoothstep(0.25,0.9,vis) * 0.62;
  // Exit / key: Perception memory green once revealed
  if (vCellKind > 6.5 && vCellKind < 7.5) lit += tint(vec3(0.35,1.0,0.55), vec3(0.2,1.0,0.78), vec3(1.0,0.75,0.2), vec3(0.25,1.0,0.25)) * smoothstep(0.15,0.85,vis) * 0.72;
  if (vCellKind > 8.9 && vCellKind < 9.5) lit += vec3(1,0.25,0.3) * smoothstep(0.12,0.75,vis) * 0.65;
  if (vCellKind > 9.9 && vCellKind < 10.5) lit += vec3(0.25,0.95,1.0) * smoothstep(0.1,0.7,vis) * 0.6;
  if (vCellKind > 10.9 && vCellKind < 11.5) lit += vec3(0.55,1.0,0.7) * smoothstep(0.12,0.75,vis) * 0.7;
  if (vCellKind > 11.9 && vCellKind < 12.5) lit += vec3(1.0,0.88,0.4) * smoothstep(0.12,0.8,vis) * 0.55;
  if (vCellKind > 12.9) lit += rimCol * smoothstep(0.08,0.75,vis) * 0.75;

  float reveal = smoothstep(0.015, 0.68, vis);
  if (uThemeMode > 2.5) reveal = smoothstep(0.0, 0.42, vis);
  fragColor = vec4(mix(voidCol, lit + rimCol * rimMask * 0.12, reveal), 1.0);
}
`;
