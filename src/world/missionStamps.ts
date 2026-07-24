/**
 * Authored layout stamps applied by mission band for mechanical identity.
 * Mutates a char grid in place (W walls, . floors, specials already placed).
 */
export type StampId =
  | "crossroads"
  | "absorb_choke"
  | "hide_alcove"
  | "twin_door"
  | "ringwell_hub"
  | "force_hide"
  | "long_throat"
  | "decoy_fork";

export function stampForMission(level: number, forceHide?: boolean, absorbChoke?: boolean, stampId?: StampId): StampId {
  if (stampId) return stampId;
  if (forceHide) return "force_hide";
  if (absorbChoke) return "absorb_choke";
  const band = [
    "crossroads",
    "hide_alcove",
    "ringwell_hub",
    "absorb_choke",
    "twin_door",
    "long_throat",
    "decoy_fork",
    "force_hide",
  ] as const;
  return band[(level - 1) % band.length]!;
}

function carveFloor(mut: string[][], x: number, z: number, W: number, H: number): void {
  if (x > 0 && z > 0 && x < W - 1 && z < H - 1 && mut[z]![x] === "W") mut[z]![x] = ".";
}

function setIfFloor(mut: string[][], x: number, z: number, ch: string): void {
  const c = mut[z]?.[x];
  if (c === "." || c === "=") mut[z]![x] = ch;
}

export function applyMissionStamp(mut: string[][], W: number, H: number, stamp: StampId, cx: number, cz: number): void {
  const clamp = (v: number, max: number) => Math.max(2, Math.min(max - 3, v));
  const x0 = clamp(cx, W);
  const z0 = clamp(cz, H);

  if (stamp === "crossroads") {
    for (let d = -3; d <= 3; d++) {
      carveFloor(mut, x0 + d, z0, W, H);
      carveFloor(mut, x0, z0 + d, W, H);
    }
    setIfFloor(mut, x0, z0, "=");
  } else if (stamp === "absorb_choke") {
    for (let d = -2; d <= 2; d++) carveFloor(mut, x0 + d, z0, W, H);
    if (mut[z0 - 1]?.[x0] === "W") mut[z0 - 1]![x0] = "a";
    if (mut[z0 + 1]?.[x0] === "W") mut[z0 + 1]![x0] = "a";
    if (mut[z0]?.[x0 - 2] === "W") mut[z0]![x0 - 2] = "a";
    if (mut[z0]?.[x0 + 2] === "W") mut[z0]![x0 + 2] = "a";
  } else if (stamp === "hide_alcove") {
    for (const [dx, dz] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [2, 0],
      [-2, 0],
    ] as const) {
      carveFloor(mut, x0 + dx, z0 + dz, W, H);
    }
    setIfFloor(mut, x0, z0, "h");
    setIfFloor(mut, x0 + 2, z0, "h");
    setIfFloor(mut, x0 - 2, z0, "h");
  } else if (stamp === "twin_door") {
    for (let d = -1; d <= 1; d++) {
      carveFloor(mut, x0 - 3, z0 + d, W, H);
      carveFloor(mut, x0 + 3, z0 + d, W, H);
      carveFloor(mut, x0 + d, z0, W, H);
    }
    // Soft seals: absorb lips instead of extra hard doors (keeps solvability)
    if (mut[z0]?.[x0 - 2] === "W") mut[z0]![x0 - 2] = "a";
    if (mut[z0]?.[x0 + 2] === "W") mut[z0]![x0 + 2] = "a";
    setIfFloor(mut, x0 - 4, z0, "s");
    setIfFloor(mut, x0 + 4, z0, "=");
  } else if (stamp === "ringwell_hub") {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dz) <= 3) carveFloor(mut, x0 + dx, z0 + dz, W, H);
      }
    }
    setIfFloor(mut, x0, z0, "=");
    setIfFloor(mut, x0 + 1, z0, "=");
    setIfFloor(mut, x0 - 1, z0, "=");
  } else if (stamp === "force_hide") {
    setIfFloor(mut, x0, z0, "h");
    setIfFloor(mut, x0 + 1, z0, "h");
    for (const [dx, dz] of [
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 0],
    ] as const) {
      carveFloor(mut, x0 + dx, z0 + dz, W, H);
      setIfFloor(mut, x0 + dx, z0 + dz, "h");
    }
  } else if (stamp === "long_throat") {
    for (let d = -5; d <= 5; d++) carveFloor(mut, x0 + d, z0, W, H);
    if (mut[z0 - 1]?.[x0] === "W") mut[z0 - 1]![x0] = "a";
    if (mut[z0 + 1]?.[x0] === "W") mut[z0 + 1]![x0] = "a";
  } else if (stamp === "decoy_fork") {
    for (let d = 0; d <= 4; d++) {
      carveFloor(mut, x0 + d, z0, W, H);
      carveFloor(mut, x0, z0 + d, W, H);
    }
    if (mut[z0]?.[x0 + 2] === "W") mut[z0]![x0 + 2] = "d";
    if (mut[z0 + 2]?.[x0] === "W") mut[z0 + 2]![x0] = "d";
  }
}
