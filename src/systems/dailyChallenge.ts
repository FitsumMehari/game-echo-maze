import { getMissionConfig, type MissionConfig } from "@/systems/campaign";

/** UTC date key YYYY-MM-DD */
export function dailyKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dailySeed(d = new Date()): number {
  const key = dailyKey(d);
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

export function getDailyMission(d = new Date()): MissionConfig {
  const seed = dailySeed(d);
  const level = 8 + (seed % 18);
  const base = getMissionConfig(level);
  return {
    ...base,
    level,
    seed,
    title: `Daily ${dailyKey(d)}`,
    briefing: "Shared seed challenge — same maze for everyone today. Beat your time and share it.",
    enemyCount: Math.min(16, base.enemyCount + 2),
  };
}

const BEST_KEY = "echo-maze-daily-best-v1";

export function loadDailyBest(): { key: string; time: number } | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { key: string; time: number };
    if (j.key !== dailyKey()) return null;
    return j;
  } catch {
    return null;
  }
}

export function saveDailyBest(time: number): void {
  try {
    const prev = loadDailyBest();
    if (prev && prev.time <= time) return;
    localStorage.setItem(BEST_KEY, JSON.stringify({ key: dailyKey(), time }));
  } catch {
    /* ignore */
  }
}

export function shareRunText(opts: {
  mission: string;
  time: string;
  grade?: string;
  seed?: number;
  daily?: boolean;
}): string {
  const parts = [
    `Echo Maze Overdrive — ${opts.mission}`,
    `Time ${opts.time}${opts.grade ? ` · Grade ${opts.grade}` : ""}`,
  ];
  if (opts.daily) parts.push(`Daily ${dailyKey()}`);
  if (opts.seed != null) parts.push(`Seed ${opts.seed}`);
  parts.push(typeof location !== "undefined" ? location.href.split("?")[0]! : "echo-maze");
  return parts.join(" · ");
}
