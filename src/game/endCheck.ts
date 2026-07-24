import { ENEMY_CATCH_RADIUS, EXIT_RADIUS } from "@/core/constants";
import type { Enemy, RunStats } from "@/core/types";
import { gradeRun } from "@/game/grades";
import type { AudioEngine } from "@/audio/AudioEngine";
import type { ParsedLevel } from "@/world/level";

export interface EndHost {
  missionLevel: number;
  simulationTime: number;
  pingCount: number;
  throwCount: number;
  harmonicPingCount: number;
  focusCount: number;
  beaconCount: number;
  echoDebt: number;
  silenceBonusCount: number;
  playerX: number;
  playerZ: number;
  hasEchoKey: boolean;
  exitDenyCooldown: number;
  enemies: Enemy[];
  level: ParsedLevel;
  exitWorld: { x: number; z: number };
  difficulty: { catchRadiusMul: number };
  audio: AudioEngine;
  lastDeathTip: string;
  lastRunSummary: RunStats | null;
  phase: "menu" | "playing" | "paused" | "won" | "lost";
  hidden: boolean;
}

export function checkEndConditions(g: EndHost): void {
  const atExit = Math.hypot(g.playerX - g.exitWorld.x, g.playerZ - g.exitWorld.z) < EXIT_RADIUS;
  if (atExit && g.level.keyPositions.length > 0 && !g.hasEchoKey && g.exitDenyCooldown <= 0) {
    g.exitDenyCooldown = 0.62;
    g.audio.playSealDenied();
  } else if (atExit && (g.hasEchoKey || g.level.keyPositions.length === 0)) {
    g.lastRunSummary = snapshotRun(g, true);
    g.phase = "won";
    g.audio.playWin();
  }
  if (g.hidden) return;
  const catchR = ENEMY_CATCH_RADIUS * g.difficulty.catchRadiusMul;
  for (const e of g.enemies) {
    if (Math.hypot(e.x - g.playerX, e.z - g.playerZ) < catchR) {
      g.lastDeathTip =
        g.echoDebt > 0.55
          ? "Heat was high — Shift-walk, use hide niches, or pause to cool down."
          : e.state === "chase"
            ? "A hunter was chasing your last noise trail."
            : "A hunter closed the gap — use beacons to misdirect.";
      g.lastRunSummary = snapshotRun(g, false);
      g.phase = "lost";
      g.audio.playLose();
      break;
    }
  }
}

export function snapshotRun(g: EndHost, won: boolean): RunStats {
  const base: RunStats = {
    missionLevel: g.missionLevel,
    timeSec: g.simulationTime,
    pings: g.pingCount,
    throws: g.throwCount,
    harmonics: g.harmonicPingCount,
    focuses: g.focusCount,
    beacons: g.beaconCount,
    echoDebt: g.echoDebt,
    silenceBonuses: g.silenceBonusCount,
    deathTip: won ? undefined : g.lastDeathTip,
  };
  base.grade = gradeRun(base, won);
  return base;
}
