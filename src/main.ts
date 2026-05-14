import "./style.css";
import { AudioEngine } from "./audioEngine";
import { Game } from "./game";
import { MultiplayerClient } from "./multiplayer";
import { drawRadar } from "./radar";
import { buildUi, type UiRefs } from "./ui";
import { formatTimeShort } from "./format";
import { getMissionConfig, loadCampaignProgress, MAX_MISSION_LEVEL, missionOptions, unlockNextMission } from "./campaign";
import { loadSettings, saveSettings, type GameSettings, type PlayMode, type ThemeId } from "./settings";

function webgl2Available(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("#app missing");

if (!webgl2Available()) {
  fatal(appRoot, "WebGL&nbsp;2 required", "Echo Maze needs WebGL&nbsp;2 and hardware acceleration. Enable GPU acceleration or update your browser, then reload.");
} else boot(appRoot);

function fatal(root: HTMLDivElement, title: string, body: string): void {
  root.innerHTML = `<div class="fatal"><h1>${title}</h1><p>${body}</p><button type="button" id="fatal-reload">Reload</button></div>`;
  root.querySelector("#fatal-reload")?.addEventListener("click", () => location.reload());
}

function boot(root: HTMLDivElement): void {
  const audio = new AudioEngine();
  let game: Game;
  try { game = new Game(audio); } catch (err) { console.error(err); fatal(root, "Could not start renderer", "Your GPU or browser blocked WebGL. Try another browser or enable hardware acceleration."); return; }
  const ui = buildUi(root, game.renderer.domElement);
  const mp = new MultiplayerClient();
  let settings = loadSettings();
  let unlockedMission = loadCampaignProgress();
  settings.selectedMission = Math.min(settings.selectedMission, unlockedMission);
  const keys = new Set<string>();
  let pointerLocked = false;
  let dragLook = false;
  let lastMouse = { x: 0, y: 0 };
  let lastTouch: { x: number; y: number } | null = null;

  const input = <T extends HTMLInputElement | HTMLSelectElement>(id: string): T => ui.inputs[id] as T;
  const mirrorIds = (base: string) => [`${base}-menu`, `${base}-pause`];

  function applySettingsToInputs(): void {
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
    }
    input<HTMLSelectElement>("mission-level").value = String(settings.selectedMission);
    input<HTMLSelectElement>("play-mode").value = settings.playMode;
    input<HTMLInputElement>("mp-name").value = settings.playerName;
    input<HTMLInputElement>("mp-room").value = settings.roomCode;
    input<HTMLInputElement>("mp-url").value = settings.relayUrl;
  }

  function persist(): void { saveSettings(settings); }

  function applySettingsToGame(): void {
    game.mouseLookMul = settings.mouseSensitivity;
    game.setVisuals(settings.theme, settings.visualAssist);
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle("visual-assist", settings.visualAssist);
    audio.setMix(settings.masterVolume, settings.sfxVolume, settings.ambienceVolume);
    ui.hudHints.classList.toggle("hidden", !settings.showHudHints && game.phase === "playing");
    ui.radar.classList.toggle("hidden", !settings.showRadar || game.phase !== "playing");
    updateCampaignText();
  }

  function wireRange(base: string, key: "mouseSensitivity" | "masterVolume" | "sfxVolume" | "ambienceVolume"): void {
    for (const id of mirrorIds(base)) input<HTMLInputElement>(id).addEventListener("input", (e) => {
      const v = parseFloat((e.currentTarget as HTMLInputElement).value);
      settings = { ...settings, [key]: v };
      mirrorIds(base).forEach((x) => (input<HTMLInputElement>(x).value = String(v)));
      persist(); applySettingsToGame();
    });
  }

  function wireCheck(base: string, key: "showHudHints" | "showRadar" | "visualAssist"): void {
    for (const id of mirrorIds(base)) input<HTMLInputElement>(id).addEventListener("change", (e) => {
      const v = (e.currentTarget as HTMLInputElement).checked;
      settings = { ...settings, [key]: v };
      mirrorIds(base).forEach((x) => (input<HTMLInputElement>(x).checked = v));
      persist(); applySettingsToGame();
    });
  }

  for (const scope of ["menu", "pause"] as const) input<HTMLSelectElement>(`set-theme-${scope}`).addEventListener("change", (e) => {
    settings.theme = (e.currentTarget as HTMLSelectElement).value as ThemeId;
    input<HTMLSelectElement>("set-theme-menu").value = settings.theme;
    input<HTMLSelectElement>("set-theme-pause").value = settings.theme;
    persist(); applySettingsToGame();
  });
  wireRange("set-mouse", "mouseSensitivity");
  wireRange("set-vol", "masterVolume");
  wireRange("set-sfx", "sfxVolume");
  wireRange("set-amb", "ambienceVolume");
  wireCheck("set-hud", "showHudHints");
  wireCheck("set-radar", "showRadar");
  wireCheck("set-assist", "visualAssist");

  function updateCampaignText(): void {
    const cfg = getMissionConfig(settings.selectedMission);
    ui.campaignProgress.textContent = `${cfg.title}: ${cfg.briefing} Unlocked: ${unlockedMission}/${MAX_MISSION_LEVEL}. Complete it to open the next mission.`;
  }

  input<HTMLSelectElement>("mission-level").addEventListener("change", (e) => {
    settings.selectedMission = Math.min(Number((e.currentTarget as HTMLSelectElement).value) || 1, unlockedMission);
    persist(); applySettingsToInputs(); updateCampaignText();
  });
  input<HTMLSelectElement>("play-mode").addEventListener("change", (e) => {
    settings.playMode = (e.currentTarget as HTMLSelectElement).value as PlayMode;
    if (settings.playMode === "single") mp.disconnect();
    persist(); updateCampaignText();
  });

  function syncMpConfig(): void {
    settings.playerName = input<HTMLInputElement>("mp-name").value.trim().slice(0, 24) || "Echo Runner";
    settings.roomCode = input<HTMLInputElement>("mp-room").value.trim().toLowerCase().replace(/\s+/g, "-") || "lobby";
    settings.relayUrl = input<HTMLInputElement>("mp-url").value.trim();
    persist();
    mp.configure(settings.roomCode, settings.playerName);
  }
  ["mp-name", "mp-room", "mp-url"].forEach((id) => input<HTMLInputElement>(id).addEventListener("change", syncMpConfig));
  ui.btnLocal.addEventListener("click", () => { settings.playMode = "ghosts"; input<HTMLSelectElement>("play-mode").value = "ghosts"; syncMpConfig(); persist(); mp.connectLocal(); audio.playJoin(); });
  ui.btnRelay.addEventListener("click", () => { settings.playMode = "ghosts"; input<HTMLSelectElement>("play-mode").value = "ghosts"; syncMpConfig(); persist(); mp.connectWebSocket(settings.relayUrl); audio.playJoin(); });
  ui.btnDisconnect.addEventListener("click", () => mp.disconnect());
  mp.onChange = (peers, status) => {
    game.applyRemotePeers(settings.playMode === "ghosts" ? peers : []);
    ui.live.textContent = `${status.label}${status.peers ? ` · ${status.peers} peer${status.peers === 1 ? "" : "s"}` : ""}`;
    ui.mpChip.textContent = settings.playMode === "single" ? "Single player" : ui.live.textContent;
  };

  applySettingsToInputs(); syncMpConfig(); applySettingsToGame();

  function updateEndStats(): void {
    const s = game.lastRunSummary;
    if (game.phase === "won" && s) {
      unlockedMission = unlockNextMission(s.missionLevel);
      settings.selectedMission = Math.min(MAX_MISSION_LEVEL, s.missionLevel + 1);
      persist(); applySettingsToInputs(); updateCampaignText();
    }
    const line = s ? `Mission ${s.missionLevel}/${MAX_MISSION_LEVEL} · Time ${formatTimeShort(s.timeSec)} · ${s.pings} pings (${s.harmonics} harmonic) · ${s.focuses} focus scans · ${s.beacons} beacons · ${s.throws} throws · heat ${Math.round(s.echoDebt * 100)}% · ${s.silenceBonuses} silence bonuses` : "";
    ui.wonStats.textContent = line;
    ui.lostStats.textContent = line;
    saveBestRun(s?.timeSec ?? null, game.phase, s?.missionLevel ?? game.missionLevel);
  }

  function showOverlay(which: "menu" | "pause" | "won" | "lost" | "none"): void {
    ui.panelMenu.classList.toggle("hidden", which !== "menu");
    ui.panelPause.classList.toggle("hidden", which !== "pause");
    ui.panelWon.classList.toggle("hidden", which !== "won");
    ui.panelLost.classList.toggle("hidden", which !== "lost");
    ui.overlay.classList.toggle("hidden", which === "none");
    const hideHud = which === "menu" || which === "won" || which === "lost";
    ui.hud.classList.toggle("hidden", hideHud);
    ui.crosshair.classList.toggle("hidden", hideHud);
    ui.radar.classList.toggle("hidden", hideHud || !settings.showRadar);
    if (which === "won") ui.btnAgainWin.textContent = game.missionLevel >= MAX_MISSION_LEVEL ? "Replay finale" : `Next mission ${game.missionLevel + 1}`;
    if (which === "won" || which === "lost") updateEndStats();
  }

  function syncPanels(): void {
    if (game.phase === "menu") showOverlay("menu");
    else if (game.phase === "paused") { applySettingsToInputs(); showOverlay("pause"); }
    else if (game.phase === "won") showOverlay("won");
    else if (game.phase === "lost") showOverlay("lost");
    else showOverlay("none");
    applySettingsToGame();
  }

  function requestGamePointerLock(): void {
    const request = game.renderer.domElement.requestPointerLock?.bind(game.renderer.domElement);
    if (!request || document.pointerLockElement === game.renderer.domElement) return;
    try {
      const result = request() as Promise<void> | undefined;
      void result?.catch(() => { /* pointer lock is optional */ });
    } catch {
      /* pointer lock is optional on mobile / restricted browsers */
    }
  }

  function startAudioUnlocked(): void {
    void audio.resume().catch((err) => {
      console.warn("Audio unlock failed; continuing silently", err);
    });
  }

  async function begin(level = settings.selectedMission): Promise<void> {
    ui.btnStart.disabled = true;
    ui.btnStart.textContent = "Starting…";
    try {
      settings.selectedMission = Math.max(1, Math.min(unlockedMission, Math.min(MAX_MISSION_LEVEL, Math.round(level))));
      persist(); applySettingsToInputs(); applySettingsToGame();
      game.startPlaying(settings.selectedMission);
      syncPanels();
      startAudioUnlocked();
      requestGamePointerLock();
    } catch (err) {
      console.error(err);
      game.goToMenu();
      syncPanels();
      ui.campaignProgress.textContent = "Could not start this mission. Check the browser console, reload, or try Mission 1.";
    } finally {
      ui.btnStart.disabled = false;
      ui.btnStart.textContent = "Begin mission";
    }
  }

  ui.btnStart.addEventListener("click", () => void begin());
  ui.btnResume.addEventListener("click", () => { game.phase = "playing"; syncPanels(); requestGamePointerLock(); startAudioUnlocked(); });
  ui.btnRestartPause.addEventListener("click", () => { game.resetLevel(); syncPanels(); requestGamePointerLock(); startAudioUnlocked(); });
  ui.btnTitlePause.addEventListener("click", () => { game.goToMenu(); syncPanels(); document.exitPointerLock(); });
  ui.btnAgainWin.addEventListener("click", () => void begin(Math.min(MAX_MISSION_LEVEL, game.missionLevel + 1)));
  ui.btnAgainLost.addEventListener("click", () => void begin(game.missionLevel));
  ui.btnTitleWin.addEventListener("click", () => { game.goToMenu(); syncPanels(); });
  ui.btnTitleLost.addEventListener("click", () => { game.goToMenu(); syncPanels(); });

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") {
      if (game.phase === "playing") { game.phase = "paused"; syncPanels(); document.exitPointerLock(); }
      else if (game.phase === "paused") { game.phase = "playing"; syncPanels(); requestGamePointerLock(); startAudioUnlocked(); }
      return;
    }
    if (e.repeat || game.phase !== "playing") return;
    if (e.code === "Space") game.tryPing();
    if (e.code === "KeyQ") game.tryFocus();
    if (e.code === "KeyE") game.tryBeacon();
    if (e.code === "KeyR") game.resetLevel();
    if (e.code === "KeyF") { const dir = game.getForwardDirection(); game.tryThrow(dir.x, dir.z); }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  document.addEventListener("pointerlockchange", () => { pointerLocked = document.pointerLockElement === game.renderer.domElement; });
  game.renderer.domElement.addEventListener("mousedown", (e) => {
    if (game.phase !== "playing") return;
    if (e.button === 0) { dragLook = true; lastMouse = { x: e.clientX, y: e.clientY }; requestGamePointerLock(); }
  });
  window.addEventListener("mouseup", () => { dragLook = false; });
  window.addEventListener("mousemove", (e) => {
    if (game.phase !== "playing") return;
    if (pointerLocked) game.addMouseLook(e.movementX, e.movementY);
    else if (dragLook) { game.addMouseLook(e.clientX - lastMouse.x, e.clientY - lastMouse.y); lastMouse = { x: e.clientX, y: e.clientY }; }
  });
  game.renderer.domElement.addEventListener("touchstart", (e) => { if (game.phase === "playing" && e.touches.length === 1) { const t = e.touches[0]!; lastTouch = { x: t.clientX, y: t.clientY }; } }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (game.phase !== "playing" || !lastTouch || e.touches.length !== 1) return;
    const t = e.touches[0]!;
    game.addMouseLook((t.clientX - lastTouch.x) * 1.35, (t.clientY - lastTouch.y) * 1.35);
    lastTouch = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchend", () => { lastTouch = null; });
  game.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && game.phase === "playing") { game.phase = "paused"; syncPanels(); document.exitPointerLock(); } });
  game.renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fatal(root, "Graphics context lost", "The GPU reset or the tab slept too long. Reload the page to continue."); });

  let last = performance.now();
  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const phaseBefore = game.phase;
    if (game.phase === "playing") {
      game.tick(dt, keys.has("KeyW") || keys.has("ArrowUp"), keys.has("KeyS") || keys.has("ArrowDown"), keys.has("KeyA") || keys.has("ArrowLeft"), keys.has("KeyD") || keys.has("ArrowRight"), keys.has("ShiftLeft") || keys.has("ShiftRight"));
      updateHud(game, ui, settings);
      if (settings.playMode === "ghosts") mp.publish(game.getNetworkState(mp.localId, settings.playerName));
      audio.updateTension(game.echoDebt, game.resonance);
    }
    if (game.phase !== phaseBefore) { if (game.phase === "won" || game.phase === "lost") document.exitPointerLock(); syncPanels(); }
    game.render();
  }
  requestAnimationFrame(frame);
  window.addEventListener("resize", () => game.resize(window.innerWidth, window.innerHeight));
  syncPanels();
}

function updateHud(game: Game, ui: UiRefs, settings: GameSettings): void {
  ui.hudTime.textContent = formatTimeShort(game.simulationTime);
  ui.missionChip.textContent = `Mission ${game.missionLevel}/${MAX_MISSION_LEVEL}`;
  const g = game.getPlayerGrid();
  ui.hudSector.textContent = `L${game.missionLevel} · Sector ${g.ix},${g.iz}`;
  ui.hudObjective.textContent = game.getObjectiveText();
  ui.meterRes.style.width = `${game.resonance}%`;
  ui.meterDebt.style.width = `${Math.min(100, game.echoDebt * 100)}%`;
  ui.keyChip.textContent = game.hasEchoKey ? "Key: held" : "Key: missing";
  ui.keyChip.classList.toggle("good", game.hasEchoKey);
  if (settings.showRadar) drawRadar(ui.radar, game.getRadarSnapshot(settings.visualAssist ? 12 : 9), settings.theme, settings.visualAssist);
}

function saveBestRun(time: number | null, phase: string, missionLevel: number): void {
  if (phase !== "won" || !time) return;
  try {
    const key = `echo-maze-best-sec-l${missionLevel}`;
    const raw = localStorage.getItem(key);
    const best = raw ? Number(raw) : Infinity;
    if (time < best) localStorage.setItem(key, String(time));
  } catch { /* ignore */ }
}
