import { AudioEngine } from "@/audio/AudioEngine";
import { MicNoise } from "@/audio/micNoise";
import { formatTimeShort } from "@/core/format";
import { Game } from "@/game/Game";
import { MultiplayerClient } from "@/net/multiplayer";
import { evaluateWinAchievements, unlockAchievement } from "@/systems/achievements";
import { bestDeltaText, formatBestLabel, saveBestTime } from "@/systems/bestTimes";
import { getMissionConfig, loadCampaignProgress, MAX_MISSION_LEVEL, unlockNextMission } from "@/systems/campaign";
import { pollGamepad } from "@/systems/controls";
import { getDailyMission, loadDailyBest, saveDailyBest, shareRunText } from "@/systems/dailyChallenge";
import { track } from "@/systems/telemetry";
import { getDifficulty } from "@/systems/difficulty";
import { clearRun, loadRun, saveRun, shouldAutosave, shouldAutosaveAtTime, snapshotEnemy } from "@/systems/runSave";
import { applyImportedProgress, exportSaveBundle, importSaveBundle } from "@/systems/saveExchange";
import { loadSettings, saveSettings, type GameSettings, type PlayMode } from "@/systems/settings";
import { buildUi, refreshAchievementList, showToast } from "@/ui";
import { updateHud, flashPing } from "@/app/hud";
import { createMobileMove, wireKeyboard, wireLookControls, wireMobile } from "@/app/input";
import { applySettingsToGame, applySettingsToInputs, getInput, wireMirroredSettings } from "@/app/settingsWire";

function webgl2Available(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function fatal(root: HTMLDivElement, title: string, body: string): void {
  root.innerHTML = `<div class="fatal"><h1>${title}</h1><p>${body}</p><button type="button" id="fatal-reload">Reload</button></div>`;
  root.querySelector("#fatal-reload")?.addEventListener("click", () => location.reload());
}

function readUrlSeed(): number | null {
  try {
    const q = new URLSearchParams(location.search);
    const s = q.get("seed");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n >>> 0 : null;
  } catch {
    return null;
  }
}

export function boot(root: HTMLDivElement): void {
  if (!webgl2Available()) {
    fatal(root, "WebGL&nbsp;2 required", "Echo Maze needs WebGL&nbsp;2 and hardware acceleration.");
    return;
  }
  const audio = new AudioEngine();
  let game: Game;
  try {
    game = new Game(audio);
  } catch (err) {
    console.error(err);
    fatal(root, "Could not start renderer", "Your GPU or browser blocked WebGL.");
    return;
  }

  const ui = buildUi(root, game.renderer.domElement);
  const mp = new MultiplayerClient();
  const mic = new MicNoise();
  let settings = loadSettings();
  let unlockedMission = loadCampaignProgress();
  settings.selectedMission = Math.min(settings.selectedMission, unlockedMission);
  if (import.meta.env.DEV) {
    (window as unknown as { __ECHO_GAME__?: Game }).__ECHO_GAME__ = game;
  }
  const keys = new Set<string>();
  const mobileMove = createMobileMove();
  let padPingLatch = false;
  let padPauseLatch = false;
  let lastAutosaveSec = -1;
  const input = getInput(ui);
  const persist = () => saveSettings(settings);
  const refresh = () => {
    applySettingsToGame(game, ui, settings, audio, updateCampaignText);
  };

  function updateCampaignText(): void {
    const cfg = settings.playMode === "daily" ? getDailyMission() : getMissionConfig(settings.selectedMission);
    const daily = loadDailyBest();
    const dailyLine =
      settings.playMode === "daily"
        ? daily
          ? ` Today’s PB: ${formatTimeShort(daily.time)}.`
          : " No daily PB yet."
        : "";
    ui.campaignProgress.textContent = `${cfg.title}: ${cfg.briefing} Unlocked: ${unlockedMission}/${MAX_MISSION_LEVEL}.${dailyLine}`;
    ui.bestTimesLine.textContent = `Selected mission PB: ${formatBestLabel(cfg.level)}`;
  }

  wireMirroredSettings(
    ui,
    () => settings,
    (s) => (settings = s),
    refresh,
    mic,
    audio,
  );
  applySettingsToInputs(ui, settings, unlockedMission);

  game.onLore = (text) => showToast(ui.toastHost, text);
  game.onPingJuice = () => flashPing(ui);

  input<HTMLSelectElement>("mission-level").addEventListener("change", (e) => {
    settings.selectedMission = Math.min(Number((e.currentTarget as HTMLSelectElement).value) || 1, unlockedMission);
    persist();
    applySettingsToInputs(ui, settings, unlockedMission);
    updateCampaignText();
  });
  input<HTMLSelectElement>("play-mode").addEventListener("change", (e) => {
    settings.playMode = (e.currentTarget as HTMLSelectElement).value as PlayMode;
    if (settings.playMode !== "ghosts") mp.disconnect();
    persist();
    updateCampaignText();
  });
  input<HTMLSelectElement>("set-difficulty").addEventListener("change", (e) => {
    settings.difficulty = (e.currentTarget as HTMLSelectElement).value as GameSettings["difficulty"];
    persist();
    refresh();
  });
  input<HTMLSelectElement>("set-mutator").addEventListener("change", (e) => {
    settings.mutator = (e.currentTarget as HTMLSelectElement).value as GameSettings["mutator"];
    persist();
    refresh();
  });

  for (const [id, key] of [
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
  ] as const) {
    const el = input<HTMLInputElement>(id);
    el.addEventListener("keydown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") return;
      settings = { ...settings, keymap: { ...settings.keymap, [key]: e.code } };
      el.value = e.code;
      persist();
      audio.playUi();
    });
  }

  function syncMpConfig(): void {
    settings.playerName = input<HTMLInputElement>("mp-name").value.trim().slice(0, 24) || "Echo Runner";
    settings.roomCode = input<HTMLInputElement>("mp-room").value.trim().toLowerCase().replace(/\s+/g, "-") || "lobby";
    settings.relayUrl = input<HTMLInputElement>("mp-url").value.trim();
    persist();
    mp.configure(settings.roomCode, settings.playerName);
  }
  ["mp-name", "mp-room", "mp-url"].forEach((id) =>
    input<HTMLInputElement>(id).addEventListener("change", syncMpConfig),
  );
  ui.btnLocal.addEventListener("click", () => {
    settings.playMode = "ghosts";
    input<HTMLSelectElement>("play-mode").value = "ghosts";
    syncMpConfig();
    persist();
    mp.connectLocal();
    audio.playJoin();
  });
  ui.btnRelay.addEventListener("click", () => {
    settings.playMode = "ghosts";
    input<HTMLSelectElement>("play-mode").value = "ghosts";
    syncMpConfig();
    persist();
    mp.connectWebSocket(settings.relayUrl);
    audio.playJoin();
  });
  ui.btnDisconnect.addEventListener("click", () => mp.disconnect());
  mp.onChange = (peers, status) => {
    game.applyRemotePeers(settings.playMode === "ghosts" ? peers : []);
    ui.live.textContent = `${status.label}${status.peers ? ` · ${status.peers} peer${status.peers === 1 ? "" : "s"}` : ""}`;
    ui.mpChip.textContent = settings.playMode === "ghosts" ? ui.live.textContent : "Single player";
  };

  function autosave(): void {
    if (!shouldAutosave(game.phase)) return;
    saveRun({
      missionLevel: game.missionLevel,
      difficulty: settings.difficulty,
      mutator: settings.mutator,
      playerX: game.playerX,
      playerZ: game.playerZ,
      yaw: game.yaw,
      pitch: game.pitch,
      simulationTime: game.simulationTime,
      resonance: game.resonance,
      echoDebt: game.echoDebt,
      hasEchoKey: game.hasEchoKey,
      doorOpen: game.doorOpen,
      seed: game.missionSeed,
      spawnX: game.spawnX,
      spawnZ: game.spawnZ,
      enemies: game.enemies.map(snapshotEnemy),
      beacons: game.beacons.map((b) => ({ ...b })),
      savedAt: Date.now(),
    });
  }

  function togglePause(): void {
    if (game.phase === "playing") {
      game.phase = "paused";
      autosave();
      syncPanels();
      document.exitPointerLock();
    } else if (game.phase === "paused") {
      game.phase = "playing";
      syncPanels();
      requestGamePointerLock();
      void audio.resume();
    }
  }

  function maybeOfferPwaInstall(): void {
    const deferred = (window as unknown as { __echoPwaPrompt?: Event }).__echoPwaPrompt as
      (Event & { prompt: () => Promise<void> }) | undefined;
    if (localStorage.getItem("echo-maze-pwa-hint")) return;
    localStorage.setItem("echo-maze-pwa-hint", "1");
    if (deferred) showToast(ui.toastHost, "Install Echo Maze for offline play — use your browser’s install prompt.");
    else showToast(ui.toastHost, "Add Echo Maze to your home screen for quick offline retries.");
  }

  function updateEndStats(): void {
    const s = game.lastRunSummary;
    if (game.phase === "won" && s) {
      if (settings.playMode === "daily") {
        saveDailyBest(s.timeSec);
        unlockAchievement("daily");
      } else {
        unlockedMission = unlockNextMission(s.missionLevel);
        settings.selectedMission = Math.min(MAX_MISSION_LEVEL, s.missionLevel + 1);
      }
      saveBestTime(s.missionLevel, s.timeSec);
      track("win");
      maybeOfferPwaInstall();
      evaluateWinAchievements(s, s.grade ?? "C", unlockedMission).forEach((t) =>
        showToast(ui.toastHost, `Achievement: ${t}`),
      );
      refreshAchievementList(ui.achList);
      persist();
      applySettingsToInputs(ui, settings, unlockedMission);
      updateCampaignText();
      clearRun();
    }
    const line = s
      ? `Mission ${s.missionLevel}/${MAX_MISSION_LEVEL} · ${formatTimeShort(s.timeSec)} · ${s.pings} pings · ${s.focuses} focus · ${s.beacons} beacons · heat ${Math.round(s.echoDebt * 100)}%`
      : "";
    const delta = s && game.phase === "won" ? bestDeltaText(s.timeSec, s.missionLevel) : "";
    ui.wonStats.textContent = `${line}${delta ? ` · ${delta}` : ""}`;
    ui.lostStats.textContent = line;
    ui.wonGrade.textContent = s?.grade ? `Grade ${s.grade}` : "";
    ui.lostGrade.textContent = s?.grade ? `Grade ${s.grade}` : "";
    ui.wonTip.textContent = delta;
    ui.lostTip.textContent = s?.deathTip ?? "";
  }

  function showOverlay(which: "menu" | "pause" | "won" | "lost" | "warn" | "tutorial" | "none"): void {
    ui.panelMenu.classList.toggle("hidden", which !== "menu");
    ui.panelPause.classList.toggle("hidden", which !== "pause");
    ui.panelWon.classList.toggle("hidden", which !== "won");
    ui.panelLost.classList.toggle("hidden", which !== "lost");
    ui.panelWarn.classList.toggle("hidden", which !== "warn");
    ui.panelTutorial.classList.toggle("hidden", which !== "tutorial");
    ui.overlay.classList.toggle("hidden", which === "none");
    const playingHud = which === "none" || which === "pause";
    const livePlay = which === "none";
    ui.hud.classList.toggle("hidden", !playingHud);
    ui.crosshair.classList.toggle("hidden", !livePlay);
    ui.abilityDock.classList.toggle("hidden", !livePlay);
    ui.threatCompass.classList.toggle("hidden", !livePlay);
    const radarOn = settings.showRadar && settings.mutator !== "no-radar";
    ui.radar.classList.toggle("hidden", !livePlay || !radarOn);
    if (which === "won")
      ui.btnAgainWin.textContent =
        game.missionLevel >= MAX_MISSION_LEVEL ? "Replay finale" : `Next mission ${game.missionLevel + 1}`;
    if (which === "won" || which === "lost") updateEndStats();
  }

  function syncPanels(): void {
    if (!settings.contentWarnAck) showOverlay("warn");
    else if (!settings.tutorialDone && game.phase === "menu") showOverlay("tutorial");
    else if (game.phase === "menu") showOverlay("menu");
    else if (game.phase === "paused") {
      applySettingsToInputs(ui, settings, unlockedMission);
      showOverlay("pause");
    } else if (game.phase === "won") showOverlay("won");
    else if (game.phase === "lost") showOverlay("lost");
    else showOverlay("none");
    refresh();
  }

  function requestGamePointerLock(): void {
    const request = game.renderer.domElement.requestPointerLock?.bind(game.renderer.domElement);
    if (!request || document.pointerLockElement === game.renderer.domElement) return;
    try {
      void (request() as Promise<void> | undefined)?.catch(() => undefined);
    } catch {
      /* optional */
    }
  }

  async function begin(level = settings.selectedMission, restore = false): Promise<void> {
    ui.btnStart.disabled = true;
    try {
      let mission =
        settings.playMode === "daily" ? getDailyMission() : getMissionConfig(Math.min(unlockedMission, level));
      const urlSeed = readUrlSeed();
      if (urlSeed != null) mission = { ...mission, seed: urlSeed, title: `${mission.title} (seed ${urlSeed})` };
      if (settings.playMode !== "daily" && urlSeed == null) {
        settings.selectedMission = mission.level;
        persist();
      }
      applySettingsToInputs(ui, settings, unlockedMission);
      refresh();
      const blob = restore ? loadRun() : null;
      if (blob && restore) {
        settings.difficulty = (blob.difficulty as GameSettings["difficulty"]) || settings.difficulty;
        settings.mutator = (blob.mutator as GameSettings["mutator"]) || settings.mutator;
        mission = settings.playMode === "daily" ? getDailyMission() : getMissionConfig(blob.missionLevel);
        if (blob.seed) mission = { ...mission, seed: blob.seed };
      }
      game.startPlaying({
        mission,
        difficulty: getDifficulty(settings.difficulty),
        mutator: settings.mutator,
        restore: blob
          ? {
              playerX: blob.playerX,
              playerZ: blob.playerZ,
              yaw: blob.yaw,
              pitch: blob.pitch,
              simulationTime: blob.simulationTime,
              resonance: blob.resonance,
              echoDebt: blob.echoDebt,
              hasEchoKey: blob.hasEchoKey,
              doorOpen: blob.doorOpen,
              seed: blob.seed,
              spawnX: blob.spawnX,
              spawnZ: blob.spawnZ,
              enemies: blob.enemies,
              beacons: blob.beacons,
            }
          : undefined,
      });
      lastAutosaveSec = -1;
      if (!restore) track("start");
      if (!settings.headphonesMode && !localStorage.getItem("echo-maze-hp-nudge")) {
        localStorage.setItem("echo-maze-hp-nudge", "1");
        window.setTimeout(() => {
          showToast(ui.toastHost, "Tip: enable Headphones spatial mode — chase direction is clearer by ear.");
        }, 1600);
      }
      syncPanels();
      void audio.resume().catch(() => undefined);
      requestGamePointerLock();
      if (settings.micNoise) void mic.enable();
    } catch (err) {
      console.error(err);
      game.goToMenu();
      syncPanels();
    } finally {
      ui.btnStart.disabled = false;
      ui.btnStart.textContent = "Begin mission";
    }
  }

  ui.btnWarnOk.addEventListener("click", () => {
    settings.contentWarnAck = true;
    persist();
    syncPanels();
    audio.playUi();
  });
  ui.btnTutOk.addEventListener("click", () => {
    settings.tutorialDone = true;
    persist();
    track("tutorial_done");
    void begin(1);
  });
  ui.btnStart.addEventListener("click", () => void begin());
  ui.btnResumeSave.addEventListener("click", () => void begin(settings.selectedMission, true));
  ui.btnResume.addEventListener("click", () => {
    game.phase = "playing";
    syncPanels();
    requestGamePointerLock();
    void audio.resume();
  });
  ui.btnRestartPause.addEventListener("click", () => {
    game.resetLevel();
    clearRun();
    syncPanels();
    requestGamePointerLock();
  });
  ui.btnTitlePause.addEventListener("click", () => {
    autosave();
    game.goToMenu();
    syncPanels();
    document.exitPointerLock();
  });
  ui.btnAgainWin.addEventListener("click", () => void begin(Math.min(MAX_MISSION_LEVEL, game.missionLevel + 1)));
  ui.btnAgainLost.addEventListener("click", () => void begin(game.missionLevel));
  ui.btnTitleWin.addEventListener("click", () => {
    game.goToMenu();
    syncPanels();
  });
  ui.btnTitleLost.addEventListener("click", () => {
    game.goToMenu();
    syncPanels();
  });

  async function shareCurrent(): Promise<void> {
    const s = game.lastRunSummary;
    const text = shareRunText({
      mission: game.missionTitle,
      time: formatTimeShort(s?.timeSec ?? game.simulationTime),
      grade: s?.grade,
      seed: game.missionSeed,
      daily: settings.playMode === "daily",
    });
    try {
      await navigator.clipboard.writeText(text);
      showToast(ui.toastHost, "Run copied to clipboard");
    } catch {
      showToast(ui.toastHost, text);
    }
  }
  ui.btnShareWin.addEventListener("click", () => void shareCurrent());
  ui.btnShareLost.addEventListener("click", () => void shareCurrent());
  ui.btnShareMenu.addEventListener("click", () => void shareCurrent());
  ui.btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) void ui.wrap.requestFullscreen?.();
    else void document.exitFullscreen?.();
  });
  ui.btnExportSave.addEventListener("click", async () => {
    const text = exportSaveBundle(settings);
    try {
      await navigator.clipboard.writeText(text);
      showToast(ui.toastHost, "Save JSON copied");
    } catch {
      showToast(ui.toastHost, "Copy failed — see console");
      console.log(text);
    }
  });
  ui.btnImportSave.addEventListener("click", () => {
    const raw = prompt("Paste Echo Maze save JSON");
    if (!raw) return;
    try {
      const bundle = importSaveBundle(raw);
      settings = bundle.settings;
      applyImportedProgress(bundle);
      unlockedMission = loadCampaignProgress();
      persist();
      applySettingsToInputs(ui, settings, unlockedMission);
      refreshAchievementList(ui.achList);
      refresh();
      showToast(ui.toastHost, "Save imported");
    } catch (err) {
      console.error(err);
      showToast(ui.toastHost, "Import failed");
    }
  });

  wireMobile(ui, game, mobileMove);
  wireKeyboard(game, keys, togglePause, () => settings.keymap);

  const lookState: {
    pointerLocked: boolean;
    dragLook: boolean;
    lastMouse: { x: number; y: number };
    lastTouch: { x: number; y: number } | null;
  } = { pointerLocked: false, dragLook: false, lastMouse: { x: 0, y: 0 }, lastTouch: null };
  wireLookControls(game, game.renderer.domElement, lookState, requestGamePointerLock);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && game.phase === "playing") {
      game.phase = "paused";
      autosave();
      syncPanels();
      document.exitPointerLock();
    }
  });
  game.renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    fatal(root, "Graphics context lost", "Reload the page to continue.");
  });

  syncMpConfig();
  refresh();
  ui.bootLoading.classList.add("hidden");
  syncPanels();

  if ("serviceWorker" in navigator) {
    void import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      .catch(() => undefined);
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    (window as unknown as { __echoPwaPrompt?: Event }).__echoPwaPrompt = e;
  });

  let last = performance.now();
  game.renderer.setAnimationLoop((now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const phaseBefore = game.phase;
    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
    const gp = pollGamepad(pads?.[0] ?? null);
    if (gp.pause && !padPauseLatch) togglePause();
    padPauseLatch = gp.pause;
    if (game.phase === "playing") {
      if (gp.lookX || gp.lookY) game.addMouseLook(gp.lookX * 18, gp.lookY * 18);
      if (gp.ping && !padPingLatch) game.tryPing();
      if (gp.focus) game.tryFocus();
      if (gp.beacon) game.tryBeacon();
      if (gp.throwStone) {
        const d = game.getForwardDirection();
        game.tryThrow(d.x, d.z);
      }
      padPingLatch = gp.ping;
      const km = settings.keymap;
      game.tick(
        dt,
        keys.has(km.forward) || keys.has("ArrowUp") || gp.forward || mobileMove.forward,
        keys.has(km.back) || keys.has("ArrowDown") || gp.back || mobileMove.back,
        keys.has(km.left) || keys.has("ArrowLeft") || gp.left || mobileMove.left,
        keys.has(km.right) || keys.has("ArrowRight") || gp.right || mobileMove.right,
        keys.has(km.stealth) || keys.has("ShiftRight") || gp.stealth || mobileMove.stealth,
        settings.micNoise ? mic.sample() : 0,
      );
      ui.juiceVignette.style.opacity = String(Math.min(0.55, game.echoDebt * 0.35 + game.threat * 0.35));
      updateHud(game, ui, settings);
      if (settings.playMode === "ghosts") mp.publish(game.getNetworkState(mp.localId, settings.playerName));
      if (shouldAutosaveAtTime(game.simulationTime, lastAutosaveSec)) {
        lastAutosaveSec = Math.floor(game.simulationTime / 8) * 8;
        autosave();
      }
    }
    if (game.phase !== phaseBefore) {
      if (game.phase === "won" || game.phase === "lost") document.exitPointerLock();
      if (game.phase === "lost") track("die");
      syncPanels();
    }
    game.render();
  });

  window.addEventListener("resize", () => game.resize(window.innerWidth, window.innerHeight));
  window.addEventListener("beforeunload", () => {
    if (game.phase === "playing" || game.phase === "paused") autosave();
  });
}
