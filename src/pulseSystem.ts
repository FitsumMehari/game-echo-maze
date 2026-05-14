import * as THREE from "three";
import { MAX_PULSES } from "./constants";

export interface Pulse {
  origin: THREE.Vector3;
  startTime: number;
  speed: number;
  strength: number;
  decay: number;
}

export class PulseSystem {
  pulses: Pulse[] = [];
  private readonly tmp = new THREE.Vector3();

  addPulse(origin: THREE.Vector3, strength: number, speed = 11, decay = 0.52, time?: number): void {
    const t = time ?? performance.now() / 1000;
    if (this.pulses.length >= MAX_PULSES) {
      this.pulses.shift();
    }
    this.tmp.copy(origin);
    this.pulses.push({
      origin: this.tmp.clone(),
      startTime: t,
      speed,
      strength,
      decay,
    });
  }

  /** Emit noise event world position for AI */
  lastNoisePos = new THREE.Vector3();
  noiseIntensity = 0;
  registerNoise(worldPos: THREE.Vector3, intensity: number): void {
    this.lastNoisePos.copy(worldPos);
    this.noiseIntensity = Math.max(this.noiseIntensity, intensity);
  }

  updateNoise(dt: number): void {
    this.noiseIntensity = Math.max(0, this.noiseIntensity - dt * 0.5);
  }

  applyToMaterial(material: THREE.RawShaderMaterial, timeSeconds: number): void {
    const u = material.uniforms;
    if (!u) return;
    u.uTime.value = timeSeconds;
    const count = Math.min(this.pulses.length, MAX_PULSES);
    u.uPulseCount.value = count;
    for (let i = 0; i < MAX_PULSES; i++) {
      const p = this.pulses[i];
      if (p) {
        u.uPulseOrigin.value[i].copy(p.origin);
        u.uPulseStart.value[i] = p.startTime;
        u.uPulseSpeed.value[i] = p.speed;
        u.uPulseStrength.value[i] = p.strength;
        u.uPulseDecay.value[i] = p.decay;
      } else {
        u.uPulseOrigin.value[i].set(0, -9999, 0);
        u.uPulseStart.value[i] = -999;
        u.uPulseSpeed.value[i] = 1;
        u.uPulseStrength.value[i] = 0;
        u.uPulseDecay.value[i] = 1;
      }
    }
  }
}

export function createPulseUniforms(): Record<string, { value: unknown }> {
  const origins: THREE.Vector3[] = [];
  for (let i = 0; i < MAX_PULSES; i++) {
    origins.push(new THREE.Vector3(0, -9999, 0));
  }
  return {
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uPulseCount: { value: 0 },
    uPulseOrigin: { value: origins },
    uPulseStart: { value: new Float32Array(MAX_PULSES) },
    uPulseSpeed: { value: new Float32Array(MAX_PULSES) },
    uPulseStrength: { value: new Float32Array(MAX_PULSES) },
    uPulseDecay: { value: new Float32Array(MAX_PULSES) },
    uThemeMode: { value: 0 },
    uVisualAssist: { value: 0 },
  };
}
