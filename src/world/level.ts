import { CELL_SIZE } from "@/core/constants";

export const Cell = {
  Empty: 0,
  Wall: 1,
  WallAbsorb: 2,
  WallDecoy: 3,
  Hazard: 4,
  Switch: 5,
  Door: 6,
  Exit: 7,
  Floor: 8,
  /** Ringwell tiles — footsteps echo louder (charge resonance faster visually). */
  Resonant: 9,
  /** Echo key pickup tile — gate requires collecting before exit counts. */
  Key: 10,
  /** Quiet hide niche — damp footsteps; hunters skip catch while stealth + low heat. */
  Hide: 11,
  /** Checkpoint token — relocates spawn without granting key. */
  Checkpoint: 12,
} as const;
export type CellType = (typeof Cell)[keyof typeof Cell];

export interface ParsedLevel {
  width: number;
  height: number;
  grid: CellType[][];
  playerIx: number;
  playerIz: number;
  enemies: { ix: number; iz: number }[];
  exit: { ix: number; iz: number };
  /** World key pickups — exit sealed until collected when non-empty. */
  keyPositions: { ix: number; iz: number }[];
}

const CHAR_MAP: Record<string, CellType | "spawn" | "enemy" | "enemy2" | "key"> = {
  "#": Cell.Wall,
  W: Cell.Wall,
  ".": Cell.Floor,
  " ": Cell.Floor,
  a: Cell.WallAbsorb,
  A: Cell.WallAbsorb,
  d: Cell.WallDecoy,
  D: Cell.WallDecoy,
  "^": Cell.Hazard,
  H: Cell.Hazard,
  s: Cell.Switch,
  S: Cell.Switch,
  o: Cell.Door,
  O: Cell.Door,
  e: Cell.Exit,
  E: Cell.Exit,
  "=": Cell.Resonant,
  "+": Cell.Resonant,
  h: Cell.Hide,
  c: Cell.Checkpoint,
  p: "spawn",
  P: "spawn",
  m: "enemy",
  M: "enemy",
  n: "enemy2",
  N: "enemy2",
  k: "key",
  K: "key",
};

export function parseLevel(rows: readonly string[]): ParsedLevel {
  if (rows.length === 0) {
    throw new Error("Empty level");
  }
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const grid: CellType[][] = [];
  let playerIx = 1;
  let playerIz = 1;
  let exitIx = 2;
  let exitIz = 2;
  const enemies: { ix: number; iz: number }[] = [];
  const keyPositions: { ix: number; iz: number }[] = [];

  for (let iz = 0; iz < height; iz++) {
    const row = rows[iz] ?? "";
    grid[iz] = [];
    for (let ix = 0; ix < width; ix++) {
      const ch = row[ix] ?? "#";
      const mapped = CHAR_MAP[ch];
      if (mapped === undefined) {
        grid[iz][ix] = Cell.Wall;
        continue;
      }
      if (mapped === "spawn") {
        playerIx = ix;
        playerIz = iz;
        grid[iz][ix] = Cell.Floor;
        continue;
      }
      if (mapped === "enemy" || mapped === "enemy2") {
        enemies.push({ ix, iz });
        grid[iz][ix] = Cell.Floor;
        continue;
      }
      if (mapped === "key") {
        keyPositions.push({ ix, iz });
        grid[iz][ix] = Cell.Key;
        continue;
      }
      grid[iz][ix] = mapped;
      if (mapped === Cell.Exit) {
        exitIx = ix;
        exitIz = iz;
      }
    }
  }

  return {
    width,
    height,
    grid,
    playerIx,
    playerIz,
    enemies,
    exit: { ix: exitIx, iz: exitIz },
    keyPositions,
  };
}

export function gridCenterWorld(ix: number, iz: number): { x: number; z: number } {
  return {
    x: (ix + 0.5) * CELL_SIZE,
    z: (iz + 0.5) * CELL_SIZE,
  };
}

export function worldToGrid(wx: number, wz: number): { ix: number; iz: number } {
  return {
    ix: Math.floor(wx / CELL_SIZE),
    iz: Math.floor(wz / CELL_SIZE),
  };
}

export function getCell(level: ParsedLevel, ix: number, iz: number): CellType {
  if (ix < 0 || iz < 0 || ix >= level.width || iz >= level.height) {
    return Cell.Wall;
  }
  return level.grid[iz]![ix]!;
}
