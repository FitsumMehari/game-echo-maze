import type { Landmark, Beacon } from "@/core/types";
import { kindForIndex, makeEnemy } from "@/game/hunterAi";
import type { Enemy } from "@/core/types";
import { Cell, getCell, gridCenterWorld, parseLevel, type ParsedLevel } from "@/world/level";
import { generateEchoMaze } from "@/world/levelGenerator";
import type { MissionConfig } from "@/systems/campaign";
import type { DifficultyProfile } from "@/systems/difficulty";
import type { MutatorId } from "@/systems/mutators";
import type { StartOptions } from "@/game/startOptions";

export type { StartOptions };
export function buildMissionLevel(
  mission: MissionConfig,
  difficulty: DifficultyProfile,
  mutator: MutatorId,
): { level: ParsedLevel; enemies: Enemy[]; landmarks: Landmark[]; seed: number } {
  let enemyCount = mission.enemyCount + difficulty.enemyCountAdd;
  if (mutator === "twin-hunt") enemyCount += 2;
  const cfg = { ...mission, enemyCount: Math.min(16, enemyCount) };
  const level = parseLevel(generateEchoMaze(cfg));
  const enemies = level.enemies.map((e, i) => {
    const c = gridCenterWorld(e.ix, e.iz);
    return makeEnemy(c.x, c.z, kindForIndex(i, cfg.level));
  });
  return { level, enemies, landmarks: seedLandmarks(level, cfg.seed, cfg.level), seed: cfg.seed };
}

export function seedLandmarks(level: ParsedLevel, seed: number, missionLevel: number): Landmark[] {
  const landmarks: Landmark[] = [];
  const floors: { x: number; z: number }[] = [];
  for (let iz = 1; iz < level.height - 1; iz++) {
    for (let ix = 1; ix < level.width - 1; ix++) {
      const c = getCell(level, ix, iz);
      if (c === Cell.Resonant || c === Cell.Floor || c === Cell.Hide) {
        floors.push(gridCenterWorld(ix, iz));
      }
    }
  }
  const n = Math.min(6, 2 + Math.floor(missionLevel / 6));
  for (let i = 0; i < n && floors.length; i++) {
    const j = (seed + i * 17) % floors.length;
    const f = floors.splice(j, 1)[0]!;
    const kinds: Landmark["kind"][] = ["drip", "vent", "hum"];
    landmarks.push({ x: f.x, z: f.z, kind: kinds[i % 3]!, nextPulse: 0.4 + i * 0.35 });
  }
  return landmarks;
}

export function applyRestore(
  target: {
    playerX: number;
    playerZ: number;
    yaw: number;
    pitch: number;
    simulationTime: number;
    resonance: number;
    echoDebt: number;
    hasEchoKey: boolean;
    doorOpen: boolean;
    spawnX: number;
    spawnZ: number;
    enemies: Enemy[];
    beacons: Beacon[];
  },
  restore: NonNullable<StartOptions["restore"]>,
): void {
  target.playerX = restore.playerX;
  target.playerZ = restore.playerZ;
  target.yaw = restore.yaw;
  target.pitch = restore.pitch;
  target.simulationTime = restore.simulationTime;
  target.resonance = restore.resonance;
  target.echoDebt = restore.echoDebt;
  target.hasEchoKey = restore.hasEchoKey;
  target.doorOpen = restore.doorOpen;
  if (typeof restore.spawnX === "number") target.spawnX = restore.spawnX;
  if (typeof restore.spawnZ === "number") target.spawnZ = restore.spawnZ;
  else if (restore.hasEchoKey) {
    target.spawnX = restore.playerX;
    target.spawnZ = restore.playerZ;
  }
  if (restore.beacons?.length) {
    target.beacons = restore.beacons.map((b) => ({ ...b }));
  }
  if (restore.enemies) {
    target.enemies = restore.enemies.map((snap) => {
      const e = makeEnemy(snap.x, snap.z, snap.kind);
      Object.assign(e, snap);
      return e;
    });
  }
}
