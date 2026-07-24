import { Cell, getCell, type ParsedLevel } from "@/world/level";

function walkable(level: ParsedLevel, ix: number, iz: number, doorOpen: boolean): boolean {
  const c = getCell(level, ix, iz);
  if (c === Cell.Wall || c === Cell.WallAbsorb || c === Cell.WallDecoy) return false;
  if (c === Cell.Door && !doorOpen) return false;
  return true;
}

/** BFS reachability used by tests and generator validation. */
export function canReach(
  level: ParsedLevel,
  from: { ix: number; iz: number },
  to: { ix: number; iz: number },
  doorOpen: boolean,
): boolean {
  const start = `${from.ix},${from.iz}`;
  const goal = `${to.ix},${to.iz}`;
  const q: [number, number][] = [[from.ix, from.iz]];
  const seen = new Set<string>([start]);
  while (q.length) {
    const [x, z] = q.shift()!;
    if (`${x},${z}` === goal) return true;
    for (const [nx, nz] of [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1],
    ] as const) {
      if (!walkable(level, nx, nz, doorOpen)) continue;
      const k = `${nx},${nz}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, nz]);
    }
  }
  return false;
}

export function assertMissionSolvable(level: ParsedLevel): string[] {
  const issues: string[] = [];
  const start = { ix: level.playerIx, iz: level.playerIz };
  if (!canReach(level, start, level.exit, true)) issues.push("exit unreachable with door open");
  for (const k of level.keyPositions) {
    if (!canReach(level, start, k, true)) issues.push(`key unreachable at ${k.ix},${k.iz}`);
  }
  return issues;
}
