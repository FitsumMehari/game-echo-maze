import { describe, expect, it } from "vitest";
import { makeEnemy, updateHunter } from "@/game/hunterAi";
import { resolveProjectileKills } from "@/game/entities";
import { findPath, nextWaypoint, spiralOffset } from "@/game/pathfinding";
import { resolvePlayerCollision, cellBlocks } from "@/game/collision";
import { parseLevel, Cell, getCell } from "@/world/level";
import { shouldAutosaveAtTime, snapshotEnemy } from "@/systems/runSave";
import { loadSettings } from "@/systems/settings";
import { dailySeed, dailyKey } from "@/systems/dailyChallenge";
import { getMutator } from "@/systems/mutators";
import { PulseSystem } from "@/game/pulseSystem";
import { stampForMission } from "@/world/missionStamps";
import { track, loadTelemetry } from "@/systems/telemetry";
import * as THREE from "three";

const tiny = parseLevel(["WWWWWW", "W.P..W", "W.WW.W", "W....W", "W.e..W", "WWWWWW"]);

describe("pathfinding", () => {
  it("finds a corridor path around walls", () => {
    const path = findPath(tiny, 1, 1, 4, 4, true);
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]).toEqual({ ix: 1, iz: 1 });
    expect(path.at(-1)).toEqual({ ix: 4, iz: 4 });
  });

  it("returns next waypoint toward goal", () => {
    const wp = nextWaypoint(tiny, 1.5, 1.5, 4.5, 4.5, true);
    expect(wp).not.toBeNull();
  });

  it("spiral offset grows with age", () => {
    const a = spiralOffset(0.2);
    const b = spiralOffset(3);
    expect(Math.hypot(b.x, b.z)).toBeGreaterThan(Math.hypot(a.x, a.z));
  });
});

describe("hunter FSM", () => {
  it("transitions idle → hear → search on sustained noise", () => {
    const e = makeEnemy(1.5, 1.5, "stalker");
    updateHunter(e, 0.2, { x: 3, z: 3 }, 0.5, 1.5, 1.5, 0, tiny, true, 1, 0.28, false);
    expect(["hear", "search", "chase"]).toContain(e.state);
    for (let i = 0; i < 20; i++) {
      updateHunter(e, 0.2, { x: 3, z: 3 }, 0.9, 1.5, 1.5, 0.4, tiny, true, 1, 0.28, false);
    }
    expect(["search", "chase"]).toContain(e.state);
  });

  it("returns home after losing interest", () => {
    const e = makeEnemy(1.5, 1.5, "stalker");
    e.x = 4.5;
    e.z = 4.5;
    e.state = "search";
    e.alert = 0.05;
    e.stateAge = 4;
    e.targetX = 4;
    e.targetZ = 4;
    updateHunter(e, 0.2, { x: 0, z: 0 }, 0, 1.5, 1.5, 0, tiny, true, 1, 0.28, false);
    expect(e.state).toBe("return");
  });
});

describe("collision slide", () => {
  it("keeps player off walls", () => {
    const r = resolvePlayerCollision(tiny, 0.2, 1.5, true);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(cellBlocks(getCell(tiny, 0, 1), true)).toBe(true);
    // Pushed out of the western wall AABB
    expect(Math.abs(r.x - 0.2)).toBeGreaterThan(0.05);
  });
});

describe("ability heat costs via pulse noise priority", () => {
  it("prefers beacon over footstep", () => {
    const ps = new PulseSystem();
    const a = new THREE.Vector3(1, 0, 1);
    const b = new THREE.Vector3(5, 0, 5);
    ps.registerNoise(a, 0.4, "footstep");
    ps.registerNoise(b, 0.35, "beacon");
    expect(ps.noiseKind).toBe("beacon");
    expect(ps.lastNoisePos.x).toBeCloseTo(5);
  });
});

describe("autosave throttle", () => {
  it("fires once per interval boundary", () => {
    expect(shouldAutosaveAtTime(8, -1)).toBe(true);
    expect(shouldAutosaveAtTime(8.5, 8)).toBe(false);
    expect(shouldAutosaveAtTime(16.01, 8)).toBe(true);
  });
});

describe("settings migrate", () => {
  it("merges keymap defaults", () => {
    const s = loadSettings();
    expect(s.keymap.ping).toBeTruthy();
    expect(s.keymap.forward).toBeTruthy();
    expect(["low", "med", "high"]).toContain(s.quality);
  });
});

describe("daily seed stability", () => {
  it("is stable for a fixed UTC day key", () => {
    const d = new Date("2026-07-24T12:00:00Z");
    expect(dailyKey(d)).toBe("2026-07-24");
    expect(dailySeed(d)).toBe(dailySeed(new Date("2026-07-24T23:59:00Z")));
  });
});

describe("mutator honesty", () => {
  it("marks finale mutators", () => {
    expect(getMutator("none").requiresFinale).toBe(false);
    expect(getMutator("blind").requiresFinale).toBe(true);
  });
});

describe("mission stamps", () => {
  it("picks force_hide when flagged", () => {
    expect(stampForMission(3, true)).toBe("force_hide");
    expect(stampForMission(7, false, true)).toBe("absorb_choke");
  });
});

describe("telemetry", () => {
  it("exposes counter shape", () => {
    const t = loadTelemetry();
    expect(typeof t.start).toBe("number");
    expect(typeof t.win).toBe("number");
    // track is best-effort when localStorage is unavailable (node)
    const next = track("start");
    expect(next.start).toBeGreaterThanOrEqual(t.start);
  });
});

describe("enemy snapshot", () => {
  it("copies hunter fields", () => {
    const e = makeEnemy(2, 3, "eater");
    e.state = "chase";
    const snap = snapshotEnemy(e);
    expect(snap.kind).toBe("eater");
    expect(snap.state).toBe("chase");
    expect(snap.x).toBe(2);
  });
});

describe("stone kills", () => {
  it("removes hunters hit by projectiles", () => {
    const enemies = [makeEnemy(1, 1, "stalker"), makeEnemy(5, 5, "ambusher")];
    const projectiles = [{ x: 1.1, z: 1.05, vx: 0, vz: 0, bounces: 0, age: 0.1 }];
    const result = resolveProjectileKills(projectiles, enemies);
    expect(result.kills).toHaveLength(1);
    expect(result.enemies).toHaveLength(1);
    expect(result.enemies[0]!.kind).toBe("ambusher");
    expect(result.projectiles).toHaveLength(0);
  });
});

describe("hide cell", () => {
  it("parses checkpoint and hide", () => {
    const lvl = parseLevel(["WWW", "Whc", "WeW"]);
    expect(getCell(lvl, 1, 1)).toBe(Cell.Hide);
    expect(getCell(lvl, 2, 1)).toBe(Cell.Checkpoint);
  });
});
