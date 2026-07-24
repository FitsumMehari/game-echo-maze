import type { Enemy, HunterKind, HunterState } from "@/core/types";
import { resolveEnemyCollision } from "@/game/collision";
import { nextWaypoint, spiralOffset } from "@/game/pathfinding";
import type { ParsedLevel } from "@/world/level";

const BASE_SPEED: Record<HunterKind, number> = {
  stalker: 2.35,
  ambusher: 2.05,
  eater: 1.85,
};

export function makeEnemy(x: number, z: number, kind: HunterKind): Enemy {
  return {
    x,
    z,
    homeX: x,
    homeZ: z,
    kind,
    state: "idle",
    stateAge: 0,
    targetX: x,
    targetZ: z,
    alert: 0,
  };
}

export function kindForIndex(i: number, missionLevel: number): HunterKind {
  if (missionLevel >= 18 && i % 3 === 2) return "eater";
  if (i % 2 === 1) return "ambusher";
  return "stalker";
}

function setState(e: Enemy, state: HunterState, onLose?: () => void): void {
  if (e.state === state) return;
  if (state === "lose" && e.state === "chase") onLose?.();
  e.state = state;
  e.stateAge = 0;
}

export function updateHunter(
  e: Enemy,
  dt: number,
  noisePos: { x: number; z: number },
  noiseIntensity: number,
  playerX: number,
  playerZ: number,
  echoDebt: number,
  level: ParsedLevel,
  doorOpen: boolean,
  speedMul: number,
  radius: number,
  usePathfinding = true,
  onLoseInterest?: () => void,
): void {
  e.stateAge += dt;
  const heard = noiseIntensity > 0.08;
  const distNoise = Math.hypot(noisePos.x - e.x, noisePos.z - e.z);
  const distPlayer = Math.hypot(playerX - e.x, playerZ - e.z);
  const hearRange = e.kind === "ambusher" ? 14 : e.kind === "eater" ? 11 : 18;

  if (heard && distNoise < hearRange) {
    e.alert = Math.min(1, e.alert + dt * (e.kind === "stalker" ? 1.4 : 1.1));
    e.targetX = noisePos.x;
    e.targetZ = noisePos.z;
    if (e.state === "idle" || e.state === "return") setState(e, "hear");
    if (e.alert > 0.35 && (e.state === "hear" || e.state === "search")) setState(e, "search");
    if (e.alert > 0.72 && distNoise < hearRange * 0.65) setState(e, "chase");
  } else {
    e.alert = Math.max(0, e.alert - dt * 0.22);
    if (e.state === "chase" && e.stateAge > 1.4 && !heard) setState(e, "lose", onLoseInterest);
    if (e.state === "lose" && e.stateAge > 2.2) setState(e, "search");
    if ((e.state === "search" || e.state === "hear") && e.alert < 0.08 && e.stateAge > 3.4) {
      setState(e, "return", onLoseInterest);
    }
    if (e.state === "return" && Math.hypot(e.x - e.homeX, e.z - e.homeZ) < 0.35) setState(e, "idle");
  }

  if (e.kind === "ambusher" && e.state === "idle" && distPlayer < 7.5 && echoDebt > 0.2) {
    setState(e, "chase");
    e.targetX = playerX;
    e.targetZ = playerZ;
    e.alert = 0.9;
  }

  let goalX = e.x;
  let goalZ = e.z;
  if (e.state === "chase" || e.state === "hear") {
    goalX = e.targetX;
    goalZ = e.targetZ;
  } else if (e.state === "search") {
    const off = spiralOffset(e.stateAge, 2.8);
    goalX = e.targetX + off.x;
    goalZ = e.targetZ + off.z;
  } else if (e.state === "return") {
    goalX = e.homeX;
    goalZ = e.homeZ;
  } else if (e.state === "lose") {
    goalX = e.x + Math.sin(e.stateAge * 2.1) * 0.8;
    goalZ = e.z + Math.cos(e.stateAge * 1.7) * 0.8;
  }

  let tx = goalX;
  let tz = goalZ;
  if (usePathfinding && (e.state === "chase" || e.state === "search" || e.state === "hear" || e.state === "return")) {
    const wp = nextWaypoint(level, e.x, e.z, goalX, goalZ, doorOpen);
    if (wp) {
      tx = wp.x;
      tz = wp.z;
    }
  }

  const dist = Math.hypot(tx - e.x, tz - e.z);
  if (dist > 0.12 && e.state !== "idle") {
    let sp = BASE_SPEED[e.kind] * speedMul * (1 + echoDebt * 0.48);
    if (e.state === "chase") sp *= 1.18;
    if (e.state === "search") sp *= 0.92;
    if (e.state === "return") sp *= 0.75;
    if (e.kind === "eater" && noiseIntensity > 0.15) sp *= 0.7;
    e.x += ((tx - e.x) / dist) * sp * dt;
    e.z += ((tz - e.z) / dist) * sp * dt;
  }

  const r = resolveEnemyCollision(level, e.x, e.z, radius, doorOpen);
  e.x = r.x;
  e.z = r.z;
}

/** Sound-eater hunters damp nearby pulse noise intensity (caller applies). */
export function eaterDampRadius(e: Enemy): number {
  return e.kind === "eater" ? 4.2 : 0;
}
