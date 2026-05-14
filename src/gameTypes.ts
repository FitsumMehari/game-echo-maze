import type { CellType } from "./level";

export type GamePhase = "menu" | "playing" | "paused" | "won" | "lost";

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
}

export interface Beacon {
  x: number;
  z: number;
  age: number;
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
  enemies: { x: number; z: number }[];
  beacons: { x: number; z: number }[];
  peers: RemotePeerState[];
}
