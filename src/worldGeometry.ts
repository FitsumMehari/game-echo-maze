import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CELL_SIZE, WALL_HEIGHT } from "./constants";
import { Cell, type CellType, type ParsedLevel } from "./level";

const BOX = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);

/**
 * Shader cellKind bands — keep aligned with `worldShader` albedoForCell.
 * World mesh: 0–7 terrain, 11 resonant floor, 12 key. Spheres: 9 hunter, 10 stone.
 */
function cellKindEncode(c: CellType): number {
  switch (c) {
    case Cell.Floor:
      return 0;
    case Cell.Wall:
      return 1;
    case Cell.WallAbsorb:
      return 2;
    case Cell.WallDecoy:
      return 3;
    case Cell.Hazard:
      return 4;
    case Cell.Switch:
      return 5;
    case Cell.Door:
      return 6;
    case Cell.Exit:
      return 7;
    case Cell.Resonant:
      return 11;
    case Cell.Key:
      return 12;
    default:
      return 1;
  }
}

function makeBoxAt(
  ix: number,
  iz: number,
  floorY: number,
  cell: CellType,
): THREE.BufferGeometry | null {
  const geom = BOX.clone();
  const cx = (ix + 0.5) * CELL_SIZE;
  const cz = (iz + 0.5) * CELL_SIZE;
  const mat = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, floorY + WALL_HEIGHT * 0.5, cz),
    new THREE.Quaternion(),
    new THREE.Vector3(1, 1, 1),
  );
  geom.applyMatrix4(mat);

  const n = geom.attributes.position.count;
  const kindArr = new Float32Array(n);
  const absArr = new Float32Array(n);
  const decoyShift = new Float32Array(n * 3);
  const decoyFlag = new Float32Array(n);

  let absorption = 1.0;
  if (cell === Cell.WallAbsorb) absorption = 0.38;
  if (cell === Cell.WallDecoy) absorption = 1.0;

  const dk = cellKindEncode(cell);
  for (let i = 0; i < n; i++) {
    kindArr[i] = dk;
    absArr[i] = absorption;
    decoyFlag[i] = cell === Cell.WallDecoy ? 1 : 0;
    decoyShift[i * 3 + 0] = cell === Cell.WallDecoy ? 1.4 : 0;
    decoyShift[i * 3 + 1] = cell === Cell.WallDecoy ? 0.35 : 0;
    decoyShift[i * 3 + 2] = cell === Cell.WallDecoy ? -0.9 : 0;
  }

  geom.setAttribute("cellKind", new THREE.BufferAttribute(kindArr, 1));
  geom.setAttribute("echoAbsorption", new THREE.BufferAttribute(absArr, 1));
  geom.setAttribute("echoDecoyShift", new THREE.BufferAttribute(decoyShift, 3));
  geom.setAttribute("echoDecoy", new THREE.BufferAttribute(decoyFlag, 1));

  return geom;
}

function makeFloorTile(ix: number, iz: number, cell: CellType): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(CELL_SIZE * 0.998, CELL_SIZE * 0.998);
  geom.rotateX(-Math.PI / 2);
  const cx = (ix + 0.5) * CELL_SIZE;
  const cz = (iz + 0.5) * CELL_SIZE;
  geom.translate(cx, 0.001, cz);

  const n = geom.attributes.position.count;
  const kindArr = new Float32Array(n);
  const absArr = new Float32Array(n);
  const decoyShift = new Float32Array(n * 3);
  const decoyFlag = new Float32Array(n);
  const dk = cellKindEncode(cell);
  let absorption = 1.0;
  if (cell === Cell.Resonant) absorption = 1.42;
  if (cell === Cell.Key) absorption = 1.08;

  for (let i = 0; i < n; i++) {
    kindArr[i] = dk;
    absArr[i] = absorption;
    decoyFlag[i] = 0;
    decoyShift[i * 3 + 0] = 0;
    decoyShift[i * 3 + 1] = 0;
    decoyShift[i * 3 + 2] = 0;
  }
  geom.setAttribute("cellKind", new THREE.BufferAttribute(kindArr, 1));
  geom.setAttribute("echoAbsorption", new THREE.BufferAttribute(absArr, 1));
  geom.setAttribute("echoDecoyShift", new THREE.BufferAttribute(decoyShift, 3));
  geom.setAttribute("echoDecoy", new THREE.BufferAttribute(decoyFlag, 1));

  return geom;
}

export function buildWorldMeshes(level: ParsedLevel): {
  merged: THREE.BufferGeometry;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
} {
  const parts: THREE.BufferGeometry[] = [];
  const { width, height, grid } = level;

  for (let iz = 0; iz < height; iz++) {
    for (let ix = 0; ix < width; ix++) {
      const c = grid[iz]![ix]!;
      const isWalk =
        c === Cell.Floor ||
        c === Cell.Hazard ||
        c === Cell.Switch ||
        c === Cell.Exit ||
        c === Cell.Resonant ||
        c === Cell.Key;
      if (isWalk) {
        parts.push(makeFloorTile(ix, iz, c));
      }

      if (
        c === Cell.Wall ||
        c === Cell.WallAbsorb ||
        c === Cell.WallDecoy ||
        c === Cell.Door
      ) {
        const g = makeBoxAt(ix, iz, 0, c);
        if (g) parts.push(g);
      }
    }
  }

  if (parts.length === 0) {
    throw new Error("No geometry generated");
  }

  const merged = mergeGeometries(parts, true);
  for (const p of parts) p.dispose();

  const bounds = {
    minX: 0,
    maxX: width * CELL_SIZE,
    minZ: 0,
    maxZ: height * CELL_SIZE,
  };

  return { merged, bounds };
}

/** Sphere with echo shader attributes — kind 9 = hunter, 10 = projectile */
export function buildEchoSphere(radius: number, cellKind: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, 16, 16);
  const n = g.attributes.position.count;
  const kindArr = new Float32Array(n);
  const absArr = new Float32Array(n);
  const decoyShift = new Float32Array(n * 3);
  const decoyFlag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    kindArr[i] = cellKind;
    absArr[i] = 1.0;
    decoyFlag[i] = 0;
    decoyShift[i * 3 + 0] = 0;
    decoyShift[i * 3 + 1] = 0;
    decoyShift[i * 3 + 2] = 0;
  }
  g.setAttribute("cellKind", new THREE.BufferAttribute(kindArr, 1));
  g.setAttribute("echoAbsorption", new THREE.BufferAttribute(absArr, 1));
  g.setAttribute("echoDecoyShift", new THREE.BufferAttribute(decoyShift, 3));
  g.setAttribute("echoDecoy", new THREE.BufferAttribute(decoyFlag, 1));
  return g;
}
