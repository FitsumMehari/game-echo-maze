import { CELL_SIZE, PLAYER_RADIUS } from "./constants";
import { Cell, getCell, type CellType, type ParsedLevel } from "./level";

export function cellBlocks(c: CellType, doorOpen: boolean): boolean {
  if (c === Cell.Wall || c === Cell.WallAbsorb || c === Cell.WallDecoy) return true;
  if (c === Cell.Door && !doorOpen) return true;
  return false;
}

/** Resolve horizontal circle vs blocking cells (full-cell AABBs on XZ). */
export function resolvePlayerCollision(
  level: ParsedLevel,
  px: number,
  pz: number,
  doorOpen: boolean,
): { x: number; z: number } {
  let x = px;
  let z = pz;
  const r = PLAYER_RADIUS;
  const minGx = Math.floor((x - r) / CELL_SIZE) - 1;
  const maxGx = Math.floor((x + r) / CELL_SIZE) + 1;
  const minGz = Math.floor((z - r) / CELL_SIZE) - 1;
  const maxGz = Math.floor((z + r) / CELL_SIZE) + 1;

  for (let iz = minGz; iz <= maxGz; iz++) {
    for (let ix = minGx; ix <= maxGx; ix++) {
      const c = getCell(level, ix, iz);
      if (!cellBlocks(c, doorOpen)) continue;
      const minX = ix * CELL_SIZE;
      const maxX = (ix + 1) * CELL_SIZE;
      const minZ = iz * CELL_SIZE;
      const maxZ = (iz + 1) * CELL_SIZE;
      const qx = clamp(x, minX, maxX);
      const qz = clamp(z, minZ, maxZ);
      const dx = x - qx;
      const dz = z - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-10) {
        const d = Math.sqrt(d2);
        x = qx + (dx / d) * r;
        z = qz + (dz / d) * r;
      } else if (d2 <= 1e-10) {
        const cx = (minX + maxX) * 0.5;
        const cz = (minZ + maxZ) * 0.5;
        const vx = x - cx;
        const vz = z - cz;
        const m = Math.max(Math.abs(vx), Math.abs(vz));
        if (m > 1e-6) {
          x = cx + (vx / m) * (CELL_SIZE * 0.5 + r + 0.01);
          z = cz + (vz / m) * (CELL_SIZE * 0.5 + r + 0.01);
        } else {
          x += r + 0.01;
        }
      }
    }
  }

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { x: px, z: pz };
  }
  return { x, z };
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Enemy sphere vs walls — smaller radius */
export function resolveEnemyCollision(
  level: ParsedLevel,
  px: number,
  pz: number,
  radius: number,
  doorOpen: boolean,
): { x: number; z: number } {
  let x = px;
  let z = pz;
  const r = radius;
  const minGx = Math.floor((x - r) / CELL_SIZE) - 1;
  const maxGx = Math.floor((x + r) / CELL_SIZE) + 1;
  const minGz = Math.floor((z - r) / CELL_SIZE) - 1;
  const maxGz = Math.floor((z + r) / CELL_SIZE) + 1;

  for (let iz = minGz; iz <= maxGz; iz++) {
    for (let ix = minGx; ix <= maxGx; ix++) {
      const c = getCell(level, ix, iz);
      if (!cellBlocks(c, doorOpen)) continue;
      const minX = ix * CELL_SIZE;
      const maxX = (ix + 1) * CELL_SIZE;
      const minZ = iz * CELL_SIZE;
      const maxZ = (iz + 1) * CELL_SIZE;
      const qx = clamp(x, minX, maxX);
      const qz = clamp(z, minZ, maxZ);
      const dx = x - qx;
      const dz = z - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-10) {
        const d = Math.sqrt(d2);
        x = qx + (dx / d) * r;
        z = qz + (dz / d) * r;
      }
    }
  }
  return { x, z };
}
