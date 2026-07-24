import { cellBlocks } from "@/game/collision";
import { getCell, gridCenterWorld, worldToGrid, type ParsedLevel } from "@/world/level";

export interface GridNode {
  ix: number;
  iz: number;
}

function key(ix: number, iz: number): number {
  return ((iz & 0xffff) << 16) | (ix & 0xffff);
}

/** BFS shortest path on grid (4-neighbor). Returns path including start and goal, or empty. */
export function findPath(
  level: ParsedLevel,
  fromIx: number,
  fromIz: number,
  toIx: number,
  toIz: number,
  doorOpen: boolean,
  maxNodes = 800,
): GridNode[] {
  if (fromIx === toIx && fromIz === toIz) return [{ ix: fromIx, iz: fromIz }];
  if (cellBlocks(getCell(level, toIx, toIz), doorOpen)) return [];

  const came = new Map<number, number>();
  const q: number[] = [];
  const start = key(fromIx, fromIz);
  q.push(start);
  came.set(start, -1);
  let head = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (head < q.length && head < maxNodes) {
    const cur = q[head++]!;
    const cx = cur & 0xffff;
    const cz = (cur >>> 16) & 0xffff;
    if (cx === toIx && cz === toIz) break;
    for (const [dx, dz] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      const nk = key(nx, nz);
      if (came.has(nk)) continue;
      if (cellBlocks(getCell(level, nx, nz), doorOpen)) continue;
      came.set(nk, cur);
      q.push(nk);
    }
  }

  const goal = key(toIx, toIz);
  if (!came.has(goal)) return [];
  const path: GridNode[] = [];
  let cur: number | undefined = goal;
  while (cur != null && cur >= 0) {
    path.push({ ix: cur & 0xffff, iz: (cur >>> 16) & 0xffff });
    const prev = came.get(cur);
    cur = prev === -1 ? undefined : prev;
  }
  path.reverse();
  return path;
}

/** Next world-space waypoint toward target using BFS (skips start cell). */
export function nextWaypoint(
  level: ParsedLevel,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  doorOpen: boolean,
): { x: number; z: number } | null {
  const from = worldToGrid(fromX, fromZ);
  const to = worldToGrid(toX, toZ);
  const path = findPath(level, from.ix, from.iz, to.ix, to.iz, doorOpen);
  if (path.length < 2) {
    if (Math.hypot(toX - fromX, toZ - fromZ) < 0.2) return null;
    return { x: toX, z: toZ };
  }
  const step = path[1]!;
  return gridCenterWorld(step.ix, step.iz);
}

/** Spiral investigation offset around a focus point (world units). */
export function spiralOffset(age: number, radius = 2.4): { x: number; z: number } {
  const ang = age * 1.35;
  const r = Math.min(radius, 0.4 + age * 0.55);
  return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
}
