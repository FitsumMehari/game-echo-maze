import type { DifficultyId } from "@/systems/difficulty";
import type { MutatorId } from "@/systems/mutators";
import { DEFAULT_KEYMAP, mergeKeymap, type KeyMap } from "@/systems/controls";

export type ThemeId = "abyss" | "neon" | "ember" | "contrast";
export type PlayMode = "single" | "ghosts" | "daily";

const STORAGE_KEY = "echo-maze-settings-v3";

export interface GameSettings {
  mouseSensitivity: number;
  masterVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  showHudHints: boolean;
  showRadar: boolean;
  visualAssist: boolean;
  theme: ThemeId;
  playerName: string;
  roomCode: string;
  relayUrl: string;
  selectedMission: number;
  playMode: PlayMode;
  difficulty: DifficultyId;
  mutator: MutatorId;
  headphonesMode: boolean;
  micNoise: boolean;
  flashReduce: boolean;
  quality: "low" | "med" | "high";
  tutorialDone: boolean;
  contentWarnAck: boolean;
  keymap: KeyMap;
}

export const THEMES: { id: ThemeId; label: string; note: string }[] = [
  { id: "abyss", label: "Abyss", note: "cool sonar darkness" },
  { id: "neon", label: "Neon", note: "arcade cyan/magenta" },
  { id: "ember", label: "Ember", note: "warm danger glow" },
  { id: "contrast", label: "High contrast", note: "max readability" },
];

export const DEFAULTS: GameSettings = {
  mouseSensitivity: 1,
  masterVolume: 0.85,
  sfxVolume: 0.9,
  ambienceVolume: 0.42,
  showHudHints: true,
  showRadar: true,
  visualAssist: false,
  theme: "abyss",
  playerName: "Echo Runner",
  roomCode: "lobby",
  relayUrl: "",
  selectedMission: 1,
  playMode: "single",
  difficulty: "normal",
  mutator: "none",
  headphonesMode: true,
  micNoise: false,
  flashReduce: false,
  quality: "high",
  tutorialDone: false,
  contentWarnAck: false,
  keymap: { ...DEFAULT_KEYMAP },
};

function clamp(n: unknown, a: number, b: number, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function text(v: unknown, fallback: string, max = 80): string {
  return typeof v === "string" ? v.trim().slice(0, max) || fallback : fallback;
}
function theme(v: unknown): ThemeId {
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : DEFAULTS.theme;
}
function mode(v: unknown): PlayMode {
  if (v === "ghosts" || v === "daily") return v;
  return "single";
}
function difficulty(v: unknown): DifficultyId {
  if (v === "story" || v === "overdrive") return v;
  return "normal";
}
function mutator(v: unknown): MutatorId {
  if (v === "no-radar" || v === "eternal-heat" || v === "twin-hunt" || v === "blind") return v;
  return "none";
}
function quality(v: unknown): "low" | "med" | "high" {
  if (v === "low" || v === "med") return v;
  return "high";
}

export function loadSettings(): GameSettings {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("echo-maze-settings-v2") ??
      localStorage.getItem("echo-maze-settings-v1");
    if (!raw) return { ...DEFAULTS, keymap: { ...DEFAULT_KEYMAP } };
    const j = JSON.parse(raw) as Partial<GameSettings>;
    return {
      mouseSensitivity: clamp(j.mouseSensitivity, 0.35, 2.5, DEFAULTS.mouseSensitivity),
      masterVolume: clamp(j.masterVolume, 0, 1, DEFAULTS.masterVolume),
      sfxVolume: clamp(j.sfxVolume, 0, 1, DEFAULTS.sfxVolume),
      ambienceVolume: clamp(j.ambienceVolume, 0, 1, DEFAULTS.ambienceVolume),
      showHudHints: bool(j.showHudHints, DEFAULTS.showHudHints),
      showRadar: bool(j.showRadar, DEFAULTS.showRadar),
      visualAssist: bool(j.visualAssist, DEFAULTS.visualAssist),
      theme: theme(j.theme),
      playerName: text(j.playerName, DEFAULTS.playerName, 24),
      roomCode: text(j.roomCode, DEFAULTS.roomCode, 32).replace(/\s+/g, "-").toLowerCase(),
      relayUrl: text(j.relayUrl, DEFAULTS.relayUrl, 160),
      selectedMission: clamp(j.selectedMission, 1, 33, DEFAULTS.selectedMission),
      playMode: mode(j.playMode),
      difficulty: difficulty(j.difficulty),
      mutator: mutator(j.mutator),
      headphonesMode: bool(j.headphonesMode, DEFAULTS.headphonesMode),
      micNoise: bool(j.micNoise, DEFAULTS.micNoise),
      flashReduce: bool(j.flashReduce, DEFAULTS.flashReduce),
      quality: quality(j.quality),
      tutorialDone: bool(j.tutorialDone, DEFAULTS.tutorialDone),
      contentWarnAck: bool(j.contentWarnAck, DEFAULTS.contentWarnAck),
      keymap: mergeKeymap(j.keymap),
    };
  } catch {
    return { ...DEFAULTS, keymap: { ...DEFAULT_KEYMAP } };
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota */
  }
}
