export type ThemeId = "abyss" | "neon" | "ember" | "contrast";
export type PlayMode = "single" | "ghosts";
const STORAGE_KEY = "echo-maze-settings-v2";

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
}

export const THEMES: { id: ThemeId; label: string; note: string }[] = [
  { id: "abyss", label: "Abyss", note: "cool sonar darkness" },
  { id: "neon", label: "Neon", note: "arcade cyan/magenta" },
  { id: "ember", label: "Ember", note: "warm danger glow" },
  { id: "contrast", label: "High contrast", note: "max readability" },
];

const DEFAULTS: GameSettings = {
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
  return v === "ghosts" ? "ghosts" : "single";
}

export function loadSettings(): GameSettings {
  try {
    const oldRaw = localStorage.getItem("echo-maze-settings-v1");
    const raw = localStorage.getItem(STORAGE_KEY) ?? oldRaw;
    if (!raw) return { ...DEFAULTS };
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
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota */
  }
}
