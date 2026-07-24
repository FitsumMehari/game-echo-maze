import { describe, expect, it } from "vitest";
import { getMissionConfig } from "@/systems/campaign";
import { getDifficulty } from "@/systems/difficulty";
import { buildMissionLevel } from "@/game/session";

describe("spawn density", () => {
  for (const level of [1, 2, 3, 5, 8]) {
    it(`mission ${level} places the full hunter pack`, () => {
      const mission = getMissionConfig(level);
      const built = buildMissionLevel(mission, getDifficulty("normal"), "none");
      expect(built.enemies.length).toBe(mission.enemyCount);
      expect(built.enemies.length).toBeGreaterThanOrEqual(5);
    });
  }
});
