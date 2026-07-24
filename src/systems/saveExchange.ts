import type { GameSettings } from "@/systems/settings";
import { loadCampaignProgress, saveCampaignProgress } from "@/systems/campaign";
import { loadAchievements } from "@/systems/achievements";
import { loadBestTime } from "@/systems/bestTimes";
import { MAX_MISSION_LEVEL } from "@/systems/campaign";

export interface SaveBundle {
  v: 1;
  settings: GameSettings;
  unlockedMission: number;
  achievements: string[];
  bestTimes: Record<string, number>;
  exportedAt: string;
}

export function exportSaveBundle(settings: GameSettings): string {
  const bestTimes: Record<string, number> = {};
  for (let i = 1; i <= MAX_MISSION_LEVEL; i++) {
    const t = loadBestTime(i);
    if (t != null) bestTimes[String(i)] = t;
  }
  const bundle: SaveBundle = {
    v: 1,
    settings,
    unlockedMission: loadCampaignProgress(),
    achievements: [...loadAchievements()],
    bestTimes,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(bundle, null, 2);
}

export function importSaveBundle(raw: string): SaveBundle {
  const j = JSON.parse(raw) as SaveBundle;
  if (!j || j.v !== 1 || !j.settings) throw new Error("Invalid save bundle");
  return j;
}

export function applyImportedProgress(bundle: SaveBundle): void {
  saveCampaignProgress(bundle.unlockedMission);
  try {
    localStorage.setItem("echo-maze-achievements-v1", JSON.stringify(bundle.achievements));
    for (const [level, time] of Object.entries(bundle.bestTimes)) {
      localStorage.setItem(`echo-maze-best-sec-l${level}`, String(time));
    }
  } catch {
    /* ignore */
  }
}
