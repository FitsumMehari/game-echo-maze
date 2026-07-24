import { parseLevel } from "@/world/level";
import { generateEchoMaze, mulberry32 } from "@/world/levelGenerator";
import { assertMissionSolvable } from "@/world/solvability";
import { getMissionConfig } from "@/systems/campaign";
import { gradeRun } from "@/game/grades";
import type { RunStats } from "@/core/types";
import { describe, expect, it } from "vitest";

describe("mulberry32", () => {
  it("is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("campaign mazes", () => {
  it("produces solvable missions for sample levels", () => {
    for (const level of [1, 5, 12, 19, 33]) {
      const cfg = getMissionConfig(level);
      const rows = generateEchoMaze(cfg);
      const parsed = parseLevel(rows);
      expect(assertMissionSolvable(parsed)).toEqual([]);
      expect(parsed.enemies.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("same seed yields same maze", () => {
    const cfg = getMissionConfig(7);
    expect(generateEchoMaze(cfg).join("\n")).toBe(generateEchoMaze(cfg).join("\n"));
  });
});

describe("gradeRun", () => {
  it("rewards quiet clears", () => {
    const quiet: RunStats = {
      missionLevel: 1,
      timeSec: 60,
      pings: 0,
      throws: 0,
      harmonics: 0,
      focuses: 1,
      beacons: 0,
      echoDebt: 0.05,
      silenceBonuses: 3,
    };
    const loud: RunStats = { ...quiet, pings: 40, echoDebt: 0.9, silenceBonuses: 0 };
    expect(["S", "A"]).toContain(gradeRun(quiet, true));
    expect(gradeRun(loud, true)).not.toBe("S");
    expect(gradeRun(quiet, false)).toBe("F");
  });
});
