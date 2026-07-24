import {
  SILENCE_BONUS_RESONANCE,
  SILENCE_DEBT_GATE,
  SILENCE_STREAK_SECONDS,
  STEP_DISTANCE,
  STEP_STRENGTH,
  STEALTH_STEP_MULT,
} from "@/core/constants";
import type { AudioEngine } from "@/audio/AudioEngine";
import { resolvePlayerCollision } from "@/game/collision";
import type { NoiseKind } from "@/game/pulseSystem";
import { Cell, getCell, gridCenterWorld, worldToGrid, type ParsedLevel } from "@/world/level";

export interface MoveHost {
  level: ParsedLevel;
  doorOpen: boolean;
  switchHeld: boolean;
  playerX: number;
  playerZ: number;
  spawnX: number;
  spawnZ: number;
  stepDistAccum: number;
  resonance: number;
  echoDebt: number;
  silenceStreakSec: number;
  silenceBonusCount: number;
  hasEchoKey: boolean;
  yaw: number;
  difficulty: { resonanceGainMul: number; heatDecayMul: number; heatGainMul: number };
  mutator: string;
  audio: AudioEngine;
  loreShown: Set<string>;
  onLore?: ((text: string) => void) | null;
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
  rebuildWorldFromLevel: () => void;
  setCheckpoint: (x: number, z: number) => void;
}

export function handleTileInteractions(g: MoveHost): void {
  const grid = worldToGrid(g.playerX, g.playerZ);
  const cell = getCell(g.level, grid.ix, grid.iz);
  const center = gridCenterWorld(grid.ix, grid.iz);
  if (cell === Cell.Key && !g.hasEchoKey && Math.hypot(g.playerX - center.x, g.playerZ - center.z) < 0.44) {
    g.hasEchoKey = true;
    g.audio.playKeyPickup();
    g.emitPulse(g.playerX, 0.35, g.playerZ, 0.55, 11, 0.5, false);
    g.setCheckpoint(center.x, center.z);
    const key = `key-${g.level.playerIx}`;
    if (!g.loreShown.has(key)) {
      g.loreShown.add(key);
      g.onLore?.("Echo key acquired — the gate will accept you now.");
    }
  }
  if (cell === Cell.Hide) {
    const hk = `hide-${grid.ix},${grid.iz}`;
    if (!g.loreShown.has(hk)) {
      g.loreShown.add(hk);
      g.onLore?.("Hide niche — hold Stealth with low heat to stay immune.");
    }
  }
  if (cell === Cell.Checkpoint) {
    const ck = `cp-${grid.ix},${grid.iz}`;
    if (Math.hypot(g.playerX - center.x, g.playerZ - center.z) < 0.44) {
      g.setCheckpoint(center.x, center.z);
      if (!g.loreShown.has(ck)) {
        g.loreShown.add(ck);
        g.audio.playUi();
        g.onLore?.("Checkpoint set — hazards return you here (key still required).");
      }
    }
  }
  if (cell === Cell.Hazard) {
    g.playerX = g.spawnX;
    g.playerZ = g.spawnZ;
    g.audio.playHazard();
    g.emitPulse(g.playerX, 0.4, g.playerZ, 0.55, 9, 0.6);
  }
  const onSwitch = cell === Cell.Switch && Math.hypot(g.playerX - center.x, g.playerZ - center.z) < 0.48;
  if (onSwitch && !g.switchHeld) {
    g.doorOpen = true;
    g.audio.playSwitch();
    g.rebuildWorldFromLevel();
    g.onLore?.("Seal open — the door geometry just cleared.");
  }
  g.switchHeld = onSwitch;
}

export function movePlayer(
  g: MoveHost,
  dt: number,
  forward: boolean,
  back: boolean,
  left: boolean,
  right: boolean,
  stealth: boolean,
): void {
  const moveSpeed = stealth ? 3.35 : 6.15;
  const sin = Math.sin(g.yaw);
  const cos = Math.cos(g.yaw);
  let mx = 0;
  let mz = 0;
  if (forward) {
    mx -= sin;
    mz -= cos;
  }
  if (back) {
    mx += sin;
    mz += cos;
  }
  if (left) {
    mx -= cos;
    mz += sin;
  }
  if (right) {
    mx += cos;
    mz -= sin;
  }
  const len = Math.hypot(mx, mz);
  if (len > 1e-6) {
    mx = (mx / len) * moveSpeed * dt;
    mz = (mz / len) * moveSpeed * dt;
  } else {
    mx = 0;
    mz = 0;
  }
  let nx = resolvePlayerCollision(g.level, g.playerX + mx, g.playerZ, g.doorOpen).x;
  let nz = resolvePlayerCollision(g.level, g.playerX, g.playerZ + mz, g.doorOpen).z;
  const r2 = resolvePlayerCollision(g.level, nx, nz, g.doorOpen);
  nx = r2.x;
  nz = r2.z;
  const moved = Math.hypot(nx - g.playerX, nz - g.playerZ);
  g.playerX = nx;
  g.playerZ = nz;
  handleFootsteps(g, dt, moved, stealth);
}

function handleFootsteps(g: MoveHost, dt: number, moved: number, stealth: boolean): void {
  const speed = moved / Math.max(dt, 1e-5);
  let chargeRate = speed < 0.14 ? 34 : stealth ? 23 : 7;
  chargeRate *= g.difficulty.resonanceGainMul;
  const grid = worldToGrid(g.playerX, g.playerZ);
  const cell = getCell(g.level, grid.ix, grid.iz);
  if (cell === Cell.Resonant) chargeRate += 6;
  if (cell === Cell.Hide) chargeRate += 4;
  g.resonance = Math.min(100, g.resonance + chargeRate * dt);
  const decay =
    (stealth || cell === Cell.Hide ? 0.107 : 0.042) *
    g.difficulty.heatDecayMul *
    (g.mutator === "eternal-heat" ? 0.15 : 1) *
    (cell === Cell.Hide ? 1.4 : 1);
  g.echoDebt = Math.max(0, g.echoDebt - decay * dt);
  if (moved <= 1e-5) return;
  g.stepDistAccum += moved;
  if (g.stepDistAccum < STEP_DISTANCE) return;
  g.stepDistAccum = 0;
  const mult = stealth || cell === Cell.Hide ? STEALTH_STEP_MULT * (cell === Cell.Hide ? 0.5 : 1) : 1;
  const stepBoost = cell === Cell.Resonant ? 1.55 : 1.0;
  g.emitPulse(g.playerX, 0.15, g.playerZ, STEP_STRENGTH * mult * stepBoost, 10, 0.58, true, "footstep");
  g.audio.playFootstep(stealth || cell === Cell.Hide);
  if (!stealth && cell !== Cell.Hide) g.echoDebt = Math.min(1, g.echoDebt + 0.03 * g.difficulty.heatGainMul);
}

export function updateQuietEconomy(g: MoveHost, dt: number, stealth: boolean): void {
  if (g.echoDebt <= SILENCE_DEBT_GATE) {
    g.silenceStreakSec += dt;
    if (g.silenceStreakSec >= SILENCE_STREAK_SECONDS) {
      g.silenceStreakSec = 0;
      g.resonance = Math.min(100, g.resonance + SILENCE_BONUS_RESONANCE + (stealth ? 4 : 0));
      g.silenceBonusCount += 1;
      g.audio.playSilenceBonus();
    }
  } else g.silenceStreakSec = 0;
}

export function isHiddenFromHunters(g: MoveHost, stealth: boolean): boolean {
  const grid = worldToGrid(g.playerX, g.playerZ);
  const cell = getCell(g.level, grid.ix, grid.iz);
  return cell === Cell.Hide && stealth && g.echoDebt < 0.28;
}
