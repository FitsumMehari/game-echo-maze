import * as THREE from "three";
import { MAX_PULSES } from "@/core/constants";

export interface Pulse {
  origin: THREE.Vector3;
  startTime: number;
  speed: number;
  strength: number;
  decay: number;
}

/** Higher rank wins when intensities are similar — hunters prefer freshest high-priority source. */
export type NoiseKind = "beacon" | "stone" | "footstep" | "pulse" | "other";

const NOISE_RANK: Record<NoiseKind, number> = {
  beacon: 4,
  stone: 3,
  pulse: 2,
  footstep: 1,
  other: 1,
};

export interface NoiseEvent {
  x: number;
  z: number;
  intensity: number;
  kind: NoiseKind;
  age: number;
}

export class PulseSystem {
  pulses: Pulse[] = [];
  private readonly tmp = new THREE.Vector3();
  lastNoisePos = new THREE.Vector3();
  noiseIntensity = 0;
  noiseKind: NoiseKind = "other";
  private queue: NoiseEvent[] = [];

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

  registerNoise(worldPos: THREE.Vector3, intensity: number, kind: NoiseKind = "pulse"): void {
    this.queue.push({ x: worldPos.x, z: worldPos.z, intensity, kind, age: 0 });
    if (this.queue.length > 12) this.queue.shift();
    this.pickBest();
  }

  private pickBest(): void {
    let best: NoiseEvent | null = null;
    let bestScore = -1;
    for (const n of this.queue) {
      const freshness = Math.max(0, 1 - n.age * 0.55);
      const score = n.intensity * (1 + NOISE_RANK[n.kind] * 0.35) * freshness;
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best && bestScore > 0.04) {
      this.lastNoisePos.set(best.x, 0, best.z);
      this.noiseIntensity = best.intensity * Math.max(0.2, 1 - best.age * 0.4);
      this.noiseKind = best.kind;
    } else {
      this.noiseIntensity = 0;
    }
  }

  updateNoise(dt: number): void {
    for (const n of this.queue) n.age += dt;
    this.queue = this.queue.filter((n) => n.age < 2.8);
    this.noiseIntensity = Math.max(0, this.noiseIntensity - dt * 0.45);
    this.pickBest();
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
    uThemeMode: { value: 0 },
    uVisualAssist: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uPulseCount: { value: 0 },
    uPulseOrigin: { value: origins },
    uPulseStart: { value: new Float32Array(MAX_PULSES) },
    uPulseSpeed: { value: new Float32Array(MAX_PULSES) },
    uPulseStrength: { value: new Float32Array(MAX_PULSES) },
    uPulseDecay: { value: new Float32Array(MAX_PULSES) },
  };
}
