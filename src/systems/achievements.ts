import type { RunStats } from "@/core/types";

const KEY = "echo-maze-achievements-v1";

export interface AchievementDef {
  id: string;
  title: string;
  hint: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-escape", title: "First Echo", hint: "Clear any mission" },
  { id: "silent-clear", title: "Ghost Protocol", hint: "Win with ≤2 pings" },
  { id: "no-ping", title: "Blind Cartographer", hint: "Win with 0 pings" },
  { id: "speed-90", title: "Quick Pulse", hint: "Win under 90 seconds" },
  { id: "beacon-master", title: "Decoy Artist", hint: "Win using ≥3 beacons" },
  { id: "campaign-10", title: "Blacksite Clearance", hint: "Unlock mission 10" },
  { id: "campaign-33", title: "Overdrive Survivor", hint: "Clear mission 33" },
  { id: "story-s", title: "Perfect Read", hint: "Earn an S grade" },
  { id: "headphones", title: "Listen Close", hint: "Enable headphones mode" },
  { id: "daily", title: "Daily Pulse", hint: "Complete a daily challenge" },
];

export function loadAchievements(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persist(set: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function unlockAchievement(id: string): string | null {
  const set = loadAchievements();
  if (set.has(id)) return null;
  set.add(id);
  persist(set);
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  return def?.title ?? id;
}

export function evaluateWinAchievements(stats: RunStats, grade: string, unlockedMission: number): string[] {
  const unlocked: string[] = [];
  const tryUnlock = (id: string) => {
    const t = unlockAchievement(id);
    if (t) unlocked.push(t);
  };
  tryUnlock("first-escape");
  if (stats.pings <= 2) tryUnlock("silent-clear");
  if (stats.pings === 0) tryUnlock("no-ping");
  if (stats.timeSec < 90) tryUnlock("speed-90");
  if (stats.beacons >= 3) tryUnlock("beacon-master");
  if (unlockedMission >= 10) tryUnlock("campaign-10");
  if (stats.missionLevel >= 33) tryUnlock("campaign-33");
  if (grade === "S") tryUnlock("story-s");
  return unlocked;
}
