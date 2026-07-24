import type { AudioEngine, PingMaterial } from "@/audio/AudioEngine";
import { PING_STRENGTH, RESONANCE_HARMONIC_COST, RESONANCE_HARMONIC_THRESHOLD, THROW_STRENGTH } from "@/core/constants";
import type { Beacon, Projectile } from "@/core/types";
import type { NoiseKind } from "@/game/pulseSystem";
import { Cell, getCell, worldToGrid, type ParsedLevel } from "@/world/level";

const MAX_PROJECTILES = 5;
const MAX_BEACONS = 3;
const PROJ_SPEED = 14;

export interface AbilityHost {
  phase: string;
  pingCooldown: number;
  focusCooldown: number;
  resonance: number;
  echoDebt: number;
  pingCount: number;
  harmonicPingCount: number;
  focusCount: number;
  beaconCount: number;
  throwCount: number;
  playerX: number;
  playerZ: number;
  projectiles: Projectile[];
  beacons: Beacon[];
  difficulty: { heatGainMul: number };
  audio: AudioEngine;
  level: ParsedLevel;
  emitPulse: (
    x: number,
    y: number,
    z: number,
    strength: number,
    speed?: number,
    decay?: number,
    noise?: boolean,
    noiseKind?: NoiseKind,
  ) => void;
}

function nearbyMaterial(g: AbilityHost): PingMaterial {
  const p = worldToGrid(g.playerX, g.playerZ);
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const c = getCell(g.level, p.ix + dx, p.iz + dz);
    if (c === Cell.WallAbsorb) return "absorb";
    if (c === Cell.WallDecoy) return "decoy";
  }
  return "normal";
}

export function tryPing(g: AbilityHost): void {
  if (g.phase !== "playing" || g.pingCooldown > 0) return;
  g.pingCount += 1;
  g.echoDebt = Math.min(1, g.echoDebt + 0.12 * g.difficulty.heatGainMul);
  const mat = nearbyMaterial(g);
  if (g.resonance >= RESONANCE_HARMONIC_THRESHOLD) {
    g.resonance -= RESONANCE_HARMONIC_COST;
    g.harmonicPingCount += 1;
    g.pingCooldown = 0.48;
    g.emitPulse(g.playerX, 0.42, g.playerZ, 1.05, 13.8, 0.43);
    g.emitPulse(g.playerX, 0.36, g.playerZ, 0.58, 7.4, 0.33);
    g.audio.playHarmonicPing();
  } else {
    g.pingCooldown = 0.35;
    g.emitPulse(g.playerX, 0.4, g.playerZ, PING_STRENGTH, 12, 0.48);
    g.audio.playPing(PING_STRENGTH, 0, mat);
    g.resonance = Math.max(0, g.resonance - 9);
  }
}

export function tryFocus(g: AbilityHost): void {
  if (g.phase !== "playing" || g.focusCooldown > 0 || g.resonance < 18) return;
  g.focusCooldown = 1.6;
  g.focusCount += 1;
  g.resonance -= 18;
  g.emitPulse(g.playerX, 0.38, g.playerZ, 0.54, 5.8, 0.22, false);
  g.emitPulse(g.playerX, 0.5, g.playerZ, 0.34, 3.6, 0.18, false);
  g.audio.playFocus();
}

export function tryBeacon(g: AbilityHost): void {
  if (g.phase !== "playing" || g.beacons.length >= MAX_BEACONS || g.resonance < 24) return;
  g.resonance -= 24;
  g.beaconCount += 1;
  g.beacons.push({ x: g.playerX, z: g.playerZ, age: 0, nextPulse: 0.1 });
  g.emitPulse(g.playerX, 0.24, g.playerZ, 0.62, 10.5, 0.55, true, "beacon");
  g.audio.playBeacon();
}

export function tryThrow(g: AbilityHost, dirX: number, dirZ: number): void {
  if (g.phase !== "playing" || g.projectiles.length >= MAX_PROJECTILES) return;
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-5) return;
  const nx = dirX / len;
  const nz = dirZ / len;
  g.throwCount += 1;
  g.echoDebt = Math.min(1, g.echoDebt + 0.078 * g.difficulty.heatGainMul);
  g.projectiles.push({
    x: g.playerX + nx * 0.45,
    z: g.playerZ + nz * 0.45,
    vx: nx * PROJ_SPEED,
    vz: nz * PROJ_SPEED,
    bounces: 0,
    age: 0,
  });
  g.audio.playThrow();
  g.emitPulse(g.playerX, 0.2, g.playerZ, 0.25, 9, 0.65, true, "stone");
}

export { THROW_STRENGTH };
