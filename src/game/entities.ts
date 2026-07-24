import type { AudioEngine } from "@/audio/AudioEngine";
import { THROW_STRENGTH } from "@/core/constants";
import type { Beacon, Enemy, Landmark, Projectile } from "@/core/types";
import { resolveEnemyCollision } from "@/game/collision";
import type { NoiseKind } from "@/game/pulseSystem";
import type { ParsedLevel } from "@/world/level";

const PROJ_RADIUS = 0.12;

/** Generous stone vs hunter body — stones are meant to be a reliable takedown. */
export const PROJECTILE_HIT_RADIUS = 0.85;

/** Closest distance from point C to segment AB. */
export function distPointToSegment(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 < 1e-8 ? 0 : ((cx - ax) * dx + (cz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx - cx, az + t * dz - cz);
}

export function updateProjectiles(
  projectiles: Projectile[],
  dt: number,
  level: ParsedLevel,
  doorOpen: boolean,
  onImpact: (x: number, z: number) => void,
  enemies: Enemy[] = [],
  hitRadius = PROJECTILE_HIT_RADIUS,
): { projectiles: Projectile[]; enemies: Enemy[]; kills: Enemy[] } {
  const alive = [...enemies];
  const kills: Enemy[] = [];
  const next: Projectile[] = [];

  for (const p of projectiles) {
    p.age += dt;
    let { x, z, vx, vz } = p;

    // Sub-step so fast stones cannot tunnel through hunters or thin corridors
    const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.2));
    const stepDt = dt / steps;
    let consumed = false;

    for (let s = 0; s < steps && !consumed; s++) {
      const prevX = x;
      const prevZ = z;
      const rx = resolveEnemyCollision(level, x + vx * stepDt, z, PROJ_RADIUS, doorOpen).x;
      if (Math.abs(rx - (x + vx * stepDt)) > 1e-5) {
        vx *= -0.72;
        x = rx;
        p.bounces++;
        onImpact(x, z);
      } else x += vx * stepDt;
      const rz = resolveEnemyCollision(level, x, z + vz * stepDt, PROJ_RADIUS, doorOpen).z;
      if (Math.abs(rz - (z + vz * stepDt)) > 1e-5) {
        vz *= -0.72;
        z = rz;
        p.bounces++;
        onImpact(x, z);
      } else z += vz * stepDt;

      const hitIdx = alive.findIndex((e) => distPointToSegment(prevX, prevZ, x, z, e.x, e.z) <= hitRadius);
      if (hitIdx >= 0) {
        kills.push(alive[hitIdx]!);
        alive.splice(hitIdx, 1);
        consumed = true;
        // Snap impact to hunter for feedback
        const dead = kills[kills.length - 1]!;
        x = dead.x;
        z = dead.z;
        onImpact(x, z);
      }
    }

    Object.assign(p, { x, z, vx, vz });
    if (!consumed && p.bounces <= 8 && p.age <= 4.5) next.push(p);
  }

  return { projectiles: next, enemies: alive, kills };
}

/** Remove hunters hit by stones at rest (or after a move). Prefer updateProjectiles path. */
export function resolveProjectileKills(
  projectiles: Projectile[],
  enemies: Enemy[],
  hitRadius = PROJECTILE_HIT_RADIUS,
): { projectiles: Projectile[]; enemies: Enemy[]; kills: Enemy[] } {
  if (!projectiles.length || !enemies.length) {
    return { projectiles, enemies, kills: [] };
  }
  const kills: Enemy[] = [];
  const aliveEnemies = [...enemies];
  const kept: Projectile[] = [];
  for (const p of projectiles) {
    const hitIdx = aliveEnemies.findIndex((e) => Math.hypot(e.x - p.x, e.z - p.z) <= hitRadius);
    if (hitIdx < 0) {
      kept.push(p);
      continue;
    }
    kills.push(aliveEnemies[hitIdx]!);
    aliveEnemies.splice(hitIdx, 1);
  }
  return { projectiles: kept, enemies: aliveEnemies, kills };
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
