import type { MazeOptions } from "@/world/levelGenerator";
import { formatBestLabel } from "@/systems/bestTimes";
import type { StampId } from "@/world/missionStamps";

export const MAX_MISSION_LEVEL = 33;
const PROGRESS_KEY = "echo-maze-campaign-v1";

export interface MissionConfig extends Required<Omit<MazeOptions, "stampId">> {
  level: number;
  title: string;
  briefing: string;
  sectorName: string;
  stampId?: StampId;
}

function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_MISSION_LEVEL, Math.round(level || 1)));
}

function odd(n: number): number {
  const v = Math.max(21, Math.round(n));
  return v % 2 === 0 ? v + 1 : v;
}

const SECTORS = [
  "Training Grid",
  "Quiet Annex",
  "Drip Corridor",
  "First Seal",
  "Ringwell Yard",
  "Violet Lie",
  "Absorb Wing",
  "Switch Gallery",
  "Hunter Drift",
  "Blacksite A",
  "Echo Stack",
  "Hazard Lattice",
  "Twin Pursuit",
  "Dead Air",
  "Beacon Forge",
  "Focus Vault",
  "Pressure Loop",
  "Sound Eater",
  "Deep Maze",
  "Blind Spiral",
  "Overheat Sector",
  "Night Relay",
  "Fracture Hall",
  "Long Silence",
  "Gate Farm",
  "Red Trace",
  "Collapse Grid",
  "Final Approach",
  "Breach Rim",
  "Pulse Abyss",
  "Last Key",
  "Overdrive Rim",
  "Terminal Gate",
];

export function getMissionConfig(levelRaw: number): MissionConfig {
  const level = clampLevel(levelRaw);
  const t = (level - 1) / (MAX_MISSION_LEVEL - 1);
  const width = odd(23 + t * 56);
  const height = odd(21 + t * 58);
  const enemyCount = Math.min(16, 5 + Math.floor((level - 1) / 2));
  const hazardCount = Math.round(2 + t * 24 + Math.max(0, level - 12) * 0.35);
  const wellCount = Math.round(7 + t * 25);
  const specialWallCount = Math.round(2 + t * 12);
  const sectorName = SECTORS[level - 1] ?? `Sector ${level}`;
  const forceHide = level === 8 || level === 16 || level === 24;
  const absorbChoke = level === 7 || level === 14 || level === 22;
  return {
    level,
    title: `${level}. ${sectorName}`,
    sectorName,
    briefing: briefingFor(level),
    seed: 5100 + level * 977,
    width,
    height,
    enemyCount,
    hazardCount,
    wellCount,
    specialWallCount,
    forceHide,
    absorbChoke,
    checkpoints: level >= 15,
  };
}

function briefingFor(level: number): string {
  if (level === 7) return "Absorb choke — rings die fast; route around damp walls.";
  if (level === 8) return "Hide alcoves matter — hold Shift in niches with low heat.";
  if (level === 14) return "Absorb choke returns: plan longer rings through quiet floors.";
  if (level === 15) return "Checkpoint tokens relocate your spawn without granting the key.";
  if (level === 16) return "Forced hide cluster — use stealth niches under pressure.";
  if (level === 1) return "Learn quiet steps, Space ping, Resonance, and the key→gate loop.";
  if (level === 2) return "Shift-walk to keep Echo heat low; silence pays Resonance.";
  if (level === 3) return "Listen for drip landmarks — ambient sound faintly maps walls.";
  if (level === 4) return "Find the switch to open the sealed door (watch it open).";
  if (level === 5) return "Ringwells amplify footsteps — use or avoid them deliberately.";
  if (level === 6) return "Violet decoy walls lie about their true position.";
  if (level <= 12) return "Deeper sector: hazards and deceptive surfaces punish noisy routing.";
  if (level <= 18) return "Blacksite: multiple hunters. Beacons lure; Focus scans silently.";
  if (level === 19) return "Sound-eater hunters damp nearby pulses — kite them carefully.";
  if (level <= 28) return "Endgame breach: large labyrinth and scarce silence windows.";
  if (level <= 32) return "Final approach: high hunter pressure and scarce safety.";
  return "Terminal gate: survive the full overdrive maze.";
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
    const best = formatBestLabel(i);
    const label = `${cfg.title} · ${cfg.width}×${cfg.height} · PB ${best}${locked ? " · locked" : ""}`;
    options.push(
      `<option value="${i}"${i === selected ? " selected" : ""}${locked ? " disabled" : ""}>${label}</option>`,
    );
  }
  return options.join("");
}
