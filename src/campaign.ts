import type { MazeOptions } from "./levelGenerator";

export const MAX_MISSION_LEVEL = 33;
const PROGRESS_KEY = "echo-maze-campaign-v1";

export interface MissionConfig extends Required<MazeOptions> {
  level: number;
  title: string;
  briefing: string;
}

function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_MISSION_LEVEL, Math.round(level || 1)));
}

function odd(n: number): number {
  const v = Math.max(21, Math.round(n));
  return v % 2 === 0 ? v + 1 : v;
}

export function getMissionConfig(levelRaw: number): MissionConfig {
  const level = clampLevel(levelRaw);
  const t = (level - 1) / (MAX_MISSION_LEVEL - 1);
  const width = odd(23 + t * 56);
  const height = odd(21 + t * 58);
  const enemyCount = Math.min(8, 1 + Math.floor((level - 1) / 5));
  const hazardCount = Math.round(2 + t * 24 + Math.max(0, level - 12) * 0.35);
  const wellCount = Math.round(7 + t * 25);
  const specialWallCount = Math.round(2 + t * 12);
  return {
    level,
    title: `Mission ${level}/${MAX_MISSION_LEVEL}`,
    briefing: briefingFor(level),
    seed: 5100 + level * 977,
    width,
    height,
    enemyCount,
    hazardCount,
    wellCount,
    specialWallCount,
  };
}

function briefingFor(level: number): string {
  if (level <= 5) return "Training grid: learn to read walls, key tones, and hunter sound trails.";
  if (level <= 12) return "Deeper sector: more hazards and deceptive surfaces punish noisy routing.";
  if (level <= 22) return "Blacksite maze: multiple hunters and pressure loops require beacons and focus scans.";
  if (level <= 32) return "Endgame breach: large labyrinth, scarce safety, and high echo discipline required.";
  return "Final mission: survive the full overdrive maze and reach the last gate.";
}

export function loadCampaignProgress(): number {
  try {
    const v = Number(localStorage.getItem(PROGRESS_KEY));
    return clampLevel(Number.isFinite(v) ? v : 1);
  } catch {
    return 1;
  }
}

export function saveCampaignProgress(unlockedLevel: number): void {
  try {
    localStorage.setItem(PROGRESS_KEY, String(clampLevel(unlockedLevel)));
  } catch {
    /* localStorage unavailable */
  }
}

export function unlockNextMission(completedLevel: number): number {
  const current = loadCampaignProgress();
  const next = clampLevel(Math.min(MAX_MISSION_LEVEL, completedLevel + 1));
  const unlocked = Math.max(current, next);
  saveCampaignProgress(unlocked);
  return unlocked;
}

export function missionOptions(selected: number, unlockedLevel = MAX_MISSION_LEVEL): string {
  const options: string[] = [];
  for (let i = 1; i <= MAX_MISSION_LEVEL; i++) {
    const cfg = getMissionConfig(i);
    const locked = i > unlockedLevel;
    const label = `${i} · ${cfg.width}×${cfg.height} · ${cfg.enemyCount} hunter${cfg.enemyCount === 1 ? "" : "s"}${locked ? " · locked" : ""}`;
    options.push(`<option value="${i}"${i === selected ? " selected" : ""}${locked ? " disabled" : ""}>${label}</option>`);
  }
  return options.join("");
}
