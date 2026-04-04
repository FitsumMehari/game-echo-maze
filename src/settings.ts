const STORAGE_KEY = "echo-maze-settings-v1";

export interface GameSettings {
  /** Multiplier on base mouse look (0.35–2.5) */
  mouseSensitivity: number;
  /** 0–1 master audio after calibration */
  masterVolume: number;
  /** Show bottom control hints during play */
  showHudHints: boolean;
}

const DEFAULTS: GameSettings = {
  mouseSensitivity: 1,
  masterVolume: 0.85,
  showHudHints: true,
};

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const j = JSON.parse(raw) as Partial<GameSettings>;
    return {
      mouseSensitivity: clamp(
        typeof j.mouseSensitivity === "number" ? j.mouseSensitivity : DEFAULTS.mouseSensitivity,
        0.35,
        2.5,
      ),
      masterVolume: clamp(
        typeof j.masterVolume === "number" ? j.masterVolume : DEFAULTS.masterVolume,
        0,
        1,
      ),
      showHudHints:
        typeof j.showHudHints === "boolean" ? j.showHudHints : DEFAULTS.showHudHints,
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

export function defaultSettings(): GameSettings {
  return { ...DEFAULTS };
}
