/** Settings binding helpers extracted from boot for reuse and file size. */
import type { Game } from "@/game/Game";
import type { UiRefs } from "@/ui";
import { getDifficulty } from "@/systems/difficulty";
import { MAX_MISSION_LEVEL, missionOptions } from "@/systems/campaign";
import { loadRun } from "@/systems/runSave";
import { saveSettings, type GameSettings } from "@/systems/settings";
import type { AudioEngine } from "@/audio/AudioEngine";
import type { MicNoise } from "@/audio/micNoise";
import { unlockAchievement } from "@/systems/achievements";
import { getMutator, type MutatorId } from "@/systems/mutators";

export function getInput(ui: UiRefs) {
  return <T extends HTMLInputElement | HTMLSelectElement>(id: string): T => ui.inputs[id] as T;
}

export function applySettingsToInputs(ui: UiRefs, settings: GameSettings, unlockedMission: number): void {
  const input = getInput(ui);
  input<HTMLSelectElement>("mission-level").innerHTML = missionOptions(settings.selectedMission, unlockedMission);
  for (const scope of ["menu", "pause"] as const) {
    input<HTMLInputElement>(`set-mouse-${scope}`).value = String(settings.mouseSensitivity);
    input<HTMLInputElement>(`set-vol-${scope}`).value = String(settings.masterVolume);
    input<HTMLInputElement>(`set-sfx-${scope}`).value = String(settings.sfxVolume);
    input<HTMLInputElement>(`set-amb-${scope}`).value = String(settings.ambienceVolume);
    input<HTMLInputElement>(`set-hud-${scope}`).checked = settings.showHudHints;
    input<HTMLInputElement>(`set-radar-${scope}`).checked = settings.showRadar;
    input<HTMLInputElement>(`set-assist-${scope}`).checked = settings.visualAssist;
    input<HTMLSelectElement>(`set-theme-${scope}`).value = settings.theme;
    input<HTMLSelectElement>(`set-quality-${scope}`).value = settings.quality;
    input<HTMLInputElement>(`set-headphones-${scope}`).checked = settings.headphonesMode;
    input<HTMLInputElement>(`set-flash-${scope}`).checked = settings.flashReduce;
    input<HTMLInputElement>(`set-mic-${scope}`).checked = settings.micNoise;
  }
  input<HTMLSelectElement>("mission-level").value = String(settings.selectedMission);
  input<HTMLSelectElement>("play-mode").value = settings.playMode;
  input<HTMLSelectElement>("set-difficulty").value = settings.difficulty;
  input<HTMLSelectElement>("set-mutator").value = settings.mutator;
  const mutSel = input<HTMLSelectElement>("set-mutator");
  const finale = unlockedMission >= MAX_MISSION_LEVEL;
  [...mutSel.options].forEach((opt) => {
    const def = getMutator(opt.value as MutatorId);
    opt.disabled = def.requiresFinale && !finale;
  });
  input<HTMLInputElement>("mp-name").value = settings.playerName;
  input<HTMLInputElement>("mp-room").value = settings.roomCode;
  input<HTMLInputElement>("mp-url").value = settings.relayUrl;
  const km = settings.keymap;
  const mapFields: [string, keyof typeof km][] = [
    ["set-forward-code", "forward"],
    ["set-back-code", "back"],
    ["set-left-code", "left"],
    ["set-right-code", "right"],
    ["set-stealth-code", "stealth"],
    ["set-ping-code", "ping"],
    ["set-focus-code", "focus"],
    ["set-beacon-code", "beacon"],
    ["set-throw-code", "throw"],
    ["set-restart-code", "restart"],
  ];
  for (const [id, key] of mapFields) {
    if (ui.inputs[id]) input<HTMLInputElement>(id).value = km[key];
  }
  ui.btnResumeSave.disabled = !loadRun();
}

export function applySettingsToGame(
  game: Game,
  ui: UiRefs,
  settings: GameSettings,
  audio: AudioEngine,
  updateCampaignText: () => void,
): void {
  game.mouseLookMul = settings.mouseSensitivity;
  game.flashReduce = settings.flashReduce;
  game.difficulty = getDifficulty(settings.difficulty);
  game.mutator = settings.mutator;
  const assist = settings.visualAssist && settings.mutator !== "blind";
  game.setVisuals(settings.theme, assist);
  game.setQuality(settings.quality);
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.classList.toggle("visual-assist", assist);
  document.documentElement.classList.toggle("flash-reduce", settings.flashReduce);
  audio.setMix(settings.masterVolume, settings.sfxVolume, settings.ambienceVolume);
  audio.setHeadphones(settings.headphonesMode);
  ui.hudHints.classList.toggle("hidden", !settings.showHudHints || game.phase !== "playing");
  const radarOn = settings.showRadar && settings.mutator !== "no-radar";
  // Overlay visibility owns radar during menus; only sync while actively playing
  if (game.phase === "playing") {
    ui.radar.classList.toggle("hidden", !radarOn);
  }
  updateCampaignText();
  if (settings.headphonesMode) unlockAchievement("headphones");
}

export function wireMirroredSettings(
  ui: UiRefs,
  getSettings: () => GameSettings,
  setSettings: (s: GameSettings) => void,
  refresh: () => void,
  mic: MicNoise,
  audio: AudioEngine,
): void {
  const input = getInput(ui);
  const mirrorIds = (base: string) => [`${base}-menu`, `${base}-pause`];
  const persist = () => saveSettings(getSettings());

  const wireRange = (base: string, key: "mouseSensitivity" | "masterVolume" | "sfxVolume" | "ambienceVolume") => {
    for (const id of mirrorIds(base)) {
      input<HTMLInputElement>(id).addEventListener("input", (e) => {
        const v = parseFloat((e.currentTarget as HTMLInputElement).value);
        setSettings({ ...getSettings(), [key]: v });
        mirrorIds(base).forEach((x) => (input<HTMLInputElement>(x).value = String(v)));
        persist();
        refresh();
      });
    }
  };

  const wireCheck = (
    base: string,
    key: "showHudHints" | "showRadar" | "visualAssist" | "headphonesMode" | "flashReduce" | "micNoise",
  ) => {
    for (const id of mirrorIds(base)) {
      input<HTMLInputElement>(id).addEventListener("change", (e) => {
        const v = (e.currentTarget as HTMLInputElement).checked;
        setSettings({ ...getSettings(), [key]: v });
        mirrorIds(base).forEach((x) => (input<HTMLInputElement>(x).checked = v));
        if (key === "micNoise") void (v ? mic.enable() : mic.disable());
        persist();
        refresh();
        audio.playUi();
      });
    }
  };

  for (const scope of ["menu", "pause"] as const) {
    input<HTMLSelectElement>(`set-theme-${scope}`).addEventListener("change", (e) => {
      const theme = (e.currentTarget as HTMLSelectElement).value as GameSettings["theme"];
      setSettings({ ...getSettings(), theme });
      input<HTMLSelectElement>("set-theme-menu").value = theme;
      input<HTMLSelectElement>("set-theme-pause").value = theme;
      persist();
      refresh();
    });
    input<HTMLSelectElement>(`set-quality-${scope}`).addEventListener("change", (e) => {
      const quality = (e.currentTarget as HTMLSelectElement).value as GameSettings["quality"];
      setSettings({ ...getSettings(), quality });
      input<HTMLSelectElement>("set-quality-menu").value = quality;
      input<HTMLSelectElement>("set-quality-pause").value = quality;
      persist();
      refresh();
    });
  }
  wireRange("set-mouse", "mouseSensitivity");
  wireRange("set-vol", "masterVolume");
  wireRange("set-sfx", "sfxVolume");
  wireRange("set-amb", "ambienceVolume");
  wireCheck("set-hud", "showHudHints");
  wireCheck("set-radar", "showRadar");
  wireCheck("set-assist", "visualAssist");
  wireCheck("set-headphones", "headphonesMode");
  wireCheck("set-flash", "flashReduce");
  wireCheck("set-mic", "micNoise");
}
