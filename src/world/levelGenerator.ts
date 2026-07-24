/**
 * Large procedural mazes — recursive backtracker + gameplay stamp pass.
 * Odd dimensions so (1,1) is a valid inner carve coordinate.
 */
import { MAZE_HEIGHT_CELLS, MAZE_WIDTH_CELLS } from "@/core/constants";
import { applyMissionStamp, stampForMission, type StampId } from "@/world/missionStamps";

export interface MazeOptions {
  seed?: number;
  width?: number;
  height?: number;
  enemyCount?: number;
  hazardCount?: number;
  wellCount?: number;
  specialWallCount?: number;
  /** Campaign mission index — drives stamp selection */
  level?: number;
  forceHide?: boolean;
  absorbChoke?: boolean;
  stampId?: StampId;
  /** Place checkpoint tokens (missions ≥15) */
  checkpoints?: boolean;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idx(ix: number, iz: number): string {
  return `${ix},${iz}`;
}

/** Carve a perfect maze; grid starts as all walls (#), carved cells become floor (.) */
function carveMaze(width: number, height: number, rnd: () => number): string[][] {
  const g: string[][] = [];
  for (let z = 0; z < height; z++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      row.push("#");
    }
    g.push(row);
  }

  const stack: [number, number][] = [[1, 1]];
  g[1]![1] = ".";

  const dirs: [number, number][] = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1]!;
    const [cx, cz] = cur;
    const neighbors: [number, number][] = [];
    for (const [dx, dz] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 1 || nz < 1 || nx >= width - 1 || nz >= height - 1) continue;
      if (g[nz]![nx] === "#") neighbors.push([nx, nz]);
    }
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const pick = neighbors[Math.floor(rnd() * neighbors.length)]!;
    const [nx, nz] = pick;
    g[nz]![nx] = ".";
    g[(cz + nz) >> 1]![(cx + nx) >> 1] = ".";
    stack.push([nx, nz]);
  }

  // Punch a few random walls so loops appear — feels less “single corridor”, more endless.
  const extra = Math.floor(width * height * 0.012);
  for (let i = 0; i < extra; i++) {
    const zx = 2 + Math.floor(rnd() * (height - 4));
    const xx = 2 + Math.floor(rnd() * (width - 4));
    if (g[zx]![xx] === "#") {
      const f1 = g[zx - 1]?.[xx] === "." || g[zx + 1]?.[xx] === ".";
      const f2 = g[zx]?.[xx - 1] === "." || g[zx]?.[xx + 1] === ".";
      if (f1 && f2) g[zx]![xx] = ".";
    }
  }

  return g;
}

function toRows(grid: string[][]): string[] {
  return grid.map((row) => row.join(""));
}

function neighbors4(ix: number, iz: number): [number, number][] {
  return [
    [ix + 1, iz],
    [ix - 1, iz],
    [ix, iz + 1],
    [ix, iz - 1],
  ];
}

function bfsPath(
  rows: readonly string[],
  width: number,
  height: number,
  start: [number, number],
  goal: [number, number],
): [number, number][] | null {
  const [sx, sz] = start;
  const [gx, gz] = goal;
  const startKey = idx(sx, sz);
  const goalKey = idx(gx, gz);
  const q: [number, number][] = [[sx, sz]];
  const prev = new Map<string, string | null>();
  prev.set(startKey, null);

  while (q.length > 0) {
    const [x, z] = q.shift()!;
    const k = idx(x, z);
    if (k === goalKey) break;
    for (const [nx, nz] of neighbors4(x, z)) {
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
      const ch = rows[nz]![nx]!;
      if (ch === "W" || ch === "#" || ch === "a" || ch === "d") continue;
      if (ch === "o") continue;
      const nk = idx(nx, nz);
      if (prev.has(nk)) continue;
      prev.set(nk, k);
      q.push([nx, nz]);
    }
  }

  if (!prev.has(goalKey)) return null;

  const path: [number, number][] = [];
  let cur: string | null = goalKey;
  while (cur) {
    const parts = cur.split(",");
    path.push([parseInt(parts[0]!, 10), parseInt(parts[1]!, 10)]);
    cur = prev.get(cur) ?? null;
  }
  path.reverse();
  return path;
}

function walkableChar(c: string): boolean {
  return c !== "W" && c !== "#" && c !== "a" && c !== "d" && c !== "o";
}

/** After maze carved as . / #, convert to level chars (W wall, . floor) */
function polishGrid(raw: string[][]): string[][] {
  const h = raw.length;
  const w = raw[0]!.length;
  const out: string[][] = [];
  for (let z = 0; z < h; z++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      const c = raw[z]![x]!;
      row.push(c === "#" ? "W" : ".");
    }
    out.push(row);
  }
  return out;
}

function farthestFloor(rows: string[], width: number, height: number, sx: number, sz: number): [number, number] {
  const q: [number, number][] = [[sx, sz]];
  const seen = new Set<string>([idx(sx, sz)]);
  let last: [number, number] = [sx, sz];
  while (q.length > 0) {
    const [x, z] = q.shift()!;
    last = [x, z];
    for (const [nx, nz] of neighbors4(x, z)) {
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
      const ch = rows[nz]![nx]!;
      if (!walkableChar(ch)) continue;
      const k = idx(nx, nz);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, nz]);
    }
  }
  return last;
}

/**
 * Build a wide/tall maze string[] for `parseLevel`.
 * @param seed — deterministic if fixed; use `Date.now()` for variety.
 */
export function generateEchoMaze(seedOrOptions: number | MazeOptions): string[] {
  const opts: MazeOptions = typeof seedOrOptions === "number" ? { seed: seedOrOptions } : seedOrOptions;
  const rnd = mulberry32(opts.seed ?? Date.now());
  const W = opts.width ?? MAZE_WIDTH_CELLS;
  const H = opts.height ?? MAZE_HEIGHT_CELLS;
  if (W % 2 === 0 || H % 2 === 0) throw new Error("Maze dimensions must be odd");

  const raw = carveMaze(W, H, rnd);
  const grid = polishGrid(raw);

  // Border wall shell (safer than relying on carve edges)
  for (let x = 0; x < W; x++) {
    grid[0]![x] = "W";
    grid[H - 1]![x] = "W";
  }
  for (let z = 0; z < H; z++) {
    grid[z]![0] = "W";
    grid[z]![W - 1] = "W";
  }

  const rows = toRows(grid);
  let spawnX = 1;
  let spawnZ = 1;
  if (rows[spawnZ]![spawnX] !== ".") {
    outer: for (let z = 1; z < H - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        if (rows[z]![x] === ".") {
          spawnX = x;
          spawnZ = z;
          break outer;
        }
      }
    }
  }

  const [exitX, exitZ] = farthestFloor(rows, W, H, spawnX, spawnZ);

  const mut = grid.map((r) => [...r]);
  mut[spawnZ]![spawnX] = "P";
  mut[exitZ]![exitX] = "e";

  const rowStrs = mut.map((r) => r.join(""));
  const path = bfsPath(rowStrs, W, H, [spawnX, spawnZ], [exitX, exitZ]);
  const innerPath = path?.filter(([x, z]) => !(x === spawnX && z === spawnZ) && !(x === exitX && z === exitZ)) ?? [];
  if (innerPath.length > 0) {
    const mid = innerPath[Math.floor(innerPath.length * 0.42)]!;
    if (mut[mid[1]]![mid[0]] === ".") mut[mid[1]]![mid[0]] = "k";
  }

  // Door + switch: horizontal door on a wall between two floor cells
  placedoor: for (let attempt = 0; attempt < 80; attempt++) {
    const iz = 4 + Math.floor(rnd() * (H - 8));
    const ix = 4 + Math.floor(rnd() * (W - 8));
    if (mut[iz]![ix] !== "W") continue;
    const open = (c: string) =>
      c === "." || c === "P" || c === "e" || c === "k" || c === "=" || c === "m" || c === "n" || c === "s";
    if (open(mut[iz]![ix - 1]!) && open(mut[iz]![ix + 1]!)) {
      mut[iz]![ix] = "o";
      if (mut[iz]![ix - 2] === ".") mut[iz]![ix - 2] = "s";
      else if (mut[iz]![ix + 2] === ".") mut[iz]![ix + 2] = "s";
      break placedoor;
    }
  }

  const floorCells: [number, number][] = [];
  for (let z = 1; z < H - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      const c = mut[z]![x]!;
      if (c === ".") floorCells.push([x, z]);
    }
  }

  const pathSet = new Set((path ?? []).map(([x, z]) => idx(x, z)));
  pathSet.add(idx(spawnX, spawnZ));
  pathSet.add(idx(exitX, exitZ));

  // Hazards — not on shortest-path tiles when possible
  const hazardPool = floorCells.filter(([x, z]) => {
    if (mut[z]![x] !== ".") return false;
    if (pathSet.has(idx(x, z))) return false;
    if (Math.hypot(x - spawnX, z - spawnZ) < 9) return false;
    return true;
  });
  const hazardCount = opts.hazardCount ?? Math.min(14, Math.max(6, Math.floor(floorCells.length * 0.004)));
  for (let i = 0; i < hazardCount && hazardPool.length > 0; i++) {
    const j = Math.floor(rnd() * hazardPool.length);
    const [x, z] = hazardPool.splice(j, 1)[0]!;
    mut[z]![x] = "H";
  }

  // Ringwells (floor only — never overlay hazards)
  const wellPool = floorCells.filter(([x, z]) => mut[z]![x] === ".");
  const wellNeed = opts.wellCount ?? Math.min(24, Math.max(10, Math.floor(floorCells.length * 0.006)));
  for (let i = 0; i < wellNeed && wellPool.length > 0; i++) {
    const j = Math.floor(rnd() * wellPool.length);
    const [x, z] = wellPool.splice(j, 1)[0]!;
    if (mut[z]![x] === ".") mut[z]![x] = "=";
  }

  // Enemies — far from spawn (re-scan after hazards / wells)
  const enemyPool: [number, number][] = [];
  for (let z = 1; z < H - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      const c = mut[z]![x]!;
      if (c === "." || c === "=") enemyPool.push([x, z]);
    }
  }
  const far = enemyPool
    .filter(([x, z]) => Math.hypot(x - spawnX, z - spawnZ) > 18)
    .sort((a, b) => {
      const da = Math.hypot(a[0] - spawnX, a[1] - spawnZ);
      const db = Math.hypot(b[0] - spawnX, b[1] - spawnZ);
      return db - da;
    });

  const placeEnemy = (pair: [number, number], letter: "m" | "n") => {
    const [x, z] = pair;
    const ch = mut[z]![x];
    if (ch === "." || ch === "=") mut[z]![x] = letter;
  };
  const enemyNeed = opts.enemyCount ?? 2;
  for (let i = 0; i < enemyNeed && i < far.length; i++) placeEnemy(far[i]!, i % 2 === 0 ? "m" : "n");

  // Hide niches — dead-end-ish floors not on main path
  const hidePool = floorCells.filter(([x, z]) => mut[z]![x] === "." && !pathSet.has(idx(x, z)));
  const hideNeed = Math.min(5, 1 + Math.floor((opts.width ?? W) / 30));
  for (let i = 0; i < hideNeed && hidePool.length > 0; i++) {
    const j = Math.floor(rnd() * hidePool.length);
    const [x, z] = hidePool.splice(j, 1)[0]!;
    mut[z]![x] = "h";
  }

  // Set-piece: small atrium loop near mid-path (maze variety)
  if (innerPath.length > 12) {
    const mid = innerPath[Math.floor(innerPath.length * 0.55)]!;
    const [cx, cz] = mid;
    for (const [dx, dz] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = cx + dx;
      const z = cz + dz;
      if (x > 1 && z > 1 && x < W - 2 && z < H - 2 && mut[z]![x] === "W") mut[z]![x] = ".";
    }
  }

  // Absorb / decoy walls (touching open floor)
  const wallCandidates: [number, number][] = [];
  for (let z = 2; z < H - 2; z++) {
    for (let x = 2; x < W - 2; x++) {
      if (mut[z]![x] !== "W") continue;
      let touches = false;
      for (const [nx, nz] of neighbors4(x, z)) {
        const ch = mut[nz]![nx]!;
        if (
          ch === "." ||
          ch === "=" ||
          ch === "H" ||
          ch === "P" ||
          ch === "e" ||
          ch === "k" ||
          ch === "s" ||
          ch === "m" ||
          ch === "n"
        ) {
          touches = true;
          break;
        }
      }
      if (touches) wallCandidates.push([x, z]);
    }
  }
  const specialNeed = opts.specialWallCount ?? 5;
  for (let i = 0; i < specialNeed && wallCandidates.length > 0; i++) {
    const j = Math.floor(rnd() * wallCandidates.length);
    const [x, z] = wallCandidates.splice(j, 1)[0]!;
    mut[z]![x] = i % 2 === 0 ? "a" : "d";
  }

  let hasKey = false;
  for (const row of mut) {
    if (row.includes("k")) hasKey = true;
  }
  if (!hasKey) {
    outerK: for (let z = 1; z < H - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const ch = mut[z]![x]!;
        if (ch === "." || ch === "=") {
          mut[z]![x] = "k";
          break outerK;
        }
      }
    }
  }

  // Mission identity stamp near mid-path
  if (innerPath.length > 8) {
    const mid = innerPath[Math.floor(innerPath.length * 0.5)]!;
    const stamp = stampForMission(opts.level ?? 1, opts.forceHide, opts.absorbChoke, opts.stampId);
    applyMissionStamp(mut, W, H, stamp, mid[0], mid[1]);
  }

  // Checkpoint tokens — relocate spawn without granting key (missions ≥15)
  if (opts.checkpoints) {
    const cpPool = floorCells.filter(([x, z]) => {
      const c = mut[z]![x]!;
      return (c === "." || c === "=") && !pathSet.has(idx(x, z)) && Math.hypot(x - spawnX, z - spawnZ) > 10;
    });
    const need = Math.min(2, 1 + Math.floor((opts.level ?? 15) / 20));
    for (let i = 0; i < need && cpPool.length > 0; i++) {
      const j = Math.floor(rnd() * cpPool.length);
      const [x, z] = cpPool.splice(j, 1)[0]!;
      if (mut[z]![x] === "." || mut[z]![x] === "=") mut[z]![x] = "c";
    }
  }

  return mut.map((r) => r.join(""));
}
