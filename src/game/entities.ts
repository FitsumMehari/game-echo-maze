import type { AudioEngine } from "@/audio/AudioEngine";
import { THROW_STRENGTH } from "@/core/constants";
import type { Beacon, Landmark, Projectile } from "@/core/types";
import { resolveEnemyCollision } from "@/game/collision";
import type { NoiseKind } from "@/game/pulseSystem";
import type { ParsedLevel } from "@/world/level";

const PROJ_RADIUS = 0.12;

export function updateProjectiles(
  projectiles: Projectile[],
  dt: number,
  level: ParsedLevel,
  doorOpen: boolean,
  onImpact: (x: number, z: number) => void,
): Projectile[] {
  const next: Projectile[] = [];
  for (const p of projectiles) {
    p.age += dt;
    let { x, z, vx, vz } = p;
    const rx = resolveEnemyCollision(level, x + vx * dt, z, PROJ_RADIUS, doorOpen).x;
    if (Math.abs(rx - (x + vx * dt)) > 1e-5) {
      vx *= -0.72;
      x = rx;
      p.bounces++;
      onImpact(x, z);
    } else x += vx * dt;
    const rz = resolveEnemyCollision(level, x, z + vz * dt, PROJ_RADIUS, doorOpen).z;
    if (Math.abs(rz - (z + vz * dt)) > 1e-5) {
      vz *= -0.72;
      z = rz;
      p.bounces++;
      onImpact(x, z);
    } else z += vz * dt;
    Object.assign(p, { x, z, vx, vz });
    if (p.bounces <= 8 && p.age <= 4.5) next.push(p);
  }
  return next;
}

export function updateBeacons(
  beacons: Beacon[],
  dt: number,
  heatGainMul: number,
  emit: (x: number, y: number, z: number, s: number, sp: number, d: number) => void,
  addHeat: (n: number) => void,
): Beacon[] {
  const keep: Beacon[] = [];
  for (const b of beacons) {
    b.age += dt;
    if (b.age >= b.nextPulse) {
      b.nextPulse += 1.1;
      emit(b.x, 0.26, b.z, 0.5, 9.4, 0.58);
      addHeat(0.012 * heatGainMul);
    }
    if (b.age <= 8.2) keep.push(b);
  }
  return keep;
}

export function updateLandmarks(
  landmarks: Landmark[],
  dt: number,
  emit: (x: number, y: number, z: number, s: number, sp: number, d: number, noise?: boolean) => void,
  audio: AudioEngine,
  playerX: number,
  playerZ: number,
): void {
  for (const lm of landmarks) {
    lm.nextPulse -= dt;
    if (lm.nextPulse > 0) continue;
    lm.nextPulse = lm.kind === "drip" ? 2.4 : lm.kind === "vent" ? 3.1 : 4.2;
    const str = lm.kind === "hum" ? 0.28 : 0.22;
    emit(lm.x, 0.2, lm.z, str, 6.5, 0.4, false);
    audio.playLandmark(lm.kind, lm.x - playerX, lm.z - playerZ);
  }
}

export function impactPing(audio: AudioEngine, emit: AbilityEmit, x: number, z: number): void {
  emit(x, 0.22, z, THROW_STRENGTH * 0.85, 11, 0.55, true, "stone");
  audio.playPing(THROW_STRENGTH * 0.35);
}

type AbilityEmit = (
  x: number,
  y: number,
  z: number,
  strength: number,
  speed?: number,
  decay?: number,
  noise?: boolean,
  noiseKind?: NoiseKind,
) => void;
