import type { CellType } from "@/world/level";

export type GamePhase = "menu" | "playing" | "paused" | "won" | "lost";

export type HunterKind = "stalker" | "ambusher" | "eater";
export type HunterState = "idle" | "hear" | "search" | "chase" | "lose" | "return";

export interface Projectile {
  x: number;
  z: number;
  vx: number;
  vz: number;
  bounces: number;
  age: number;
}

export interface Enemy {
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  kind: HunterKind;
  state: HunterState;
  stateAge: number;
  targetX: number;
  targetZ: number;
  alert: number;
}

export interface Beacon {
  x: number;
  z: number;
  age: number;
  nextPulse: number;
}

export interface Landmark {
  x: number;
  z: number;
  kind: "drip" | "vent" | "hum";
  nextPulse: number;
}

export interface RunStats {
  missionLevel: number;
  timeSec: number;
  pings: number;
  throws: number;
  harmonics: number;
  focuses: number;
  beacons: number;
  echoDebt: number;
  silenceBonuses: number;
  grade?: string;
  deathTip?: string;
}

export interface RemotePeerState {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  phase: GamePhase;
  heat: number;
  resonance: number;
  t: number;
}

export interface RadarCell {
  ix: number;
  iz: number;
  cell: CellType;
}

export interface RadarSnapshot {
  radius: number;
  cells: RadarCell[];
  player: { ix: number; iz: number; x: number; z: number; yaw: number };
  exit: { ix: number; iz: number };
  keys: { ix: number; iz: number }[];
  enemies: { x: number; z: number; state?: HunterState; kind?: HunterKind }[];
  beacons: { x: number; z: number }[];
  peers: RemotePeerState[];
  /** Perception-style memory: once-seen key/exit stay tinted */
  memoryKey?: { ix: number; iz: number } | null;
  memoryExit?: { ix: number; iz: number } | null;
}
