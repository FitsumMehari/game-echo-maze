import type { Beacon, Enemy, GamePhase } from "@/core/types";

const SAVE_KEY = "echo-maze-run-save-v2";
const LEGACY_KEY = "echo-maze-run-save-v1";

export interface EnemySnapshot {
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  kind: Enemy["kind"];
  state: Enemy["state"];
  stateAge: number;
  targetX: number;
  targetZ: number;
  alert: number;
}

export interface RunSaveBlob {
  v: 2;
  missionLevel: number;
  difficulty: string;
  mutator: string;
  playerX: number;
  playerZ: number;
  yaw: number;
  pitch: number;
  simulationTime: number;
  resonance: number;
  echoDebt: number;
  hasEchoKey: boolean;
  doorOpen: boolean;
  seed: number;
  spawnX: number;
  spawnZ: number;
  enemies: EnemySnapshot[];
  beacons: Beacon[];
  savedAt: number;
}

export function saveRun(blob: Omit<RunSaveBlob, "v" | "savedAt"> & { savedAt?: number }): void {
  try {
    const full: RunSaveBlob = { ...blob, v: 2, savedAt: blob.savedAt ?? Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(full));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function loadRun(): RunSaveBlob | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<RunSaveBlob> & { missionLevel?: number };
    if (!j || typeof j.missionLevel !== "number") return null;
    return {
      v: 2,
      missionLevel: j.missionLevel,
      difficulty: String(j.difficulty ?? "normal"),
      mutator: String(j.mutator ?? "none"),
      playerX: Number(j.playerX) || 0,
      playerZ: Number(j.playerZ) || 0,
      yaw: Number(j.yaw) || 0,
      pitch: Number(j.pitch) || 0,
      simulationTime: Number(j.simulationTime) || 0,
      resonance: Number(j.resonance) || 0,
      echoDebt: Number(j.echoDebt) || 0,
      hasEchoKey: !!j.hasEchoKey,
      doorOpen: !!j.doorOpen,
      seed: Number(j.seed) || 0,
      spawnX: Number(j.spawnX ?? j.playerX) || 0,
      spawnZ: Number(j.spawnZ ?? j.playerZ) || 0,
      enemies: Array.isArray(j.enemies) ? j.enemies : [],
      beacons: Array.isArray(j.beacons) ? j.beacons : [],
      savedAt: Number(j.savedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldAutosave(phase: GamePhase): boolean {
  return phase === "playing" || phase === "paused";
}

/** Returns true once when simulationTime crosses the next interval boundary. */
export function shouldAutosaveAtTime(simulationTime: number, lastAutosaveSec: number, intervalSec = 8): boolean {
  const bucket = Math.floor(simulationTime / intervalSec) * intervalSec;
  return bucket > 0 && bucket !== lastAutosaveSec && simulationTime >= bucket;
}

export function snapshotEnemy(e: Enemy): EnemySnapshot {
  return {
    x: e.x,
    z: e.z,
    homeX: e.homeX,
    homeZ: e.homeZ,
    kind: e.kind,
    state: e.state,
    stateAge: e.stateAge,
    targetX: e.targetX,
    targetZ: e.targetZ,
    alert: e.alert,
  };
}
