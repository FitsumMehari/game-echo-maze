import "./style.css";
import { AudioEngine } from "./audioEngine";
import { Game } from "./game";
import { formatTimeShort } from "./format";
import { loadSettings, saveSettings, type GameSettings } from "./settings";

function webgl2Available(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("#app missing");

if (!webgl2Available()) {
  appRoot.innerHTML = `
    <div class="fatal">
      <h1>WebGL&nbsp;2 required</h1>
      <p>Echo Maze needs WebGL&nbsp;2 (hardware acceleration). Enable GPU acceleration in your browser settings or update your GPU drivers, then reload.</p>
      <button type="button" id="fatal-reload">Reload</button>
    </div>`;
  appRoot.querySelector("#fatal-reload")?.addEventListener("click", () => location.reload());
} else {
  boot(appRoot);
}

function boot(root: HTMLDivElement): void {
  const audio = new AudioEngine();
  let game: Game;
  try {
    game = new Game(audio);
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <div class="fatal">
        <h1>Could not start renderer</h1>
        <p>Your GPU or browser blocked WebGL. Try another browser or enable hardware acceleration.</p>
        <button type="button" id="fatal-reload">Reload</button>
      </div>`;
    root.querySelector("#fatal-reload")?.addEventListener("click", () => location.reload());
    return;
  }

  let settings: GameSettings = loadSettings();

  const wrap = document.createElement("div");
  wrap.className = "game-wrap";
  wrap.appendChild(game.renderer.domElement);

  const crosshair = document.createElement("div");
  crosshair.className = "crosshair";
  crosshair.setAttribute("aria-hidden", "true");

  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="hud-top">
      <span id="hud-time" class="hud-time" role="timer" aria-live="polite">0:00</span>
      <span id="hud-sector" class="hud-sector" aria-hidden="true"></span>
      <span class="hud-brand">Echo Maze</span>
    </div>
    <div class="hud-meters" aria-hidden="true">
      <div class="meter-row"><span class="meter-name">Resonance</span><div class="meter-track"><div id="meter-res" class="meter-fill res"></div></div></div>
      <div class="meter-row"><span class="meter-name heat">Echo heat</span><div class="meter-track"><div id="meter-debt" class="meter-fill debt"></div></div></div>
    </div>
    <div id="hud-hints" class="hud-body">
      <p class="hud-line"><kbd>WASD</kbd> · <kbd>Shift</kbd> quiet · <kbd>Space</kbd> ping · at high Resonance → <strong>harmonic</strong> twin-ring · <kbd>F</kbd> throw · <kbd>R</kbd> · <kbd>Esc</kbd></p>
      <p class="hud-tip">The maze stays <strong>dim</strong>—<kbd>Space</kbd> paints detail in sound. <strong>Ringwells</strong> (+) amplify footsteps. Grab the <strong>echo key</strong> or the exit stays sealed. <strong>Echo heat</strong> speeds hunters. Keep heat low ~4s for a <strong>silence dividend</strong> (+Resonance). Violet walls <em>lie</em>—their false echo breathes.</p>
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel" id="panel-menu" role="dialog" aria-labelledby="menu-title">
      <p class="tagline">Sonar stealth exploration</p>
      <h1 id="menu-title">Echo Maze</h1>
      <p><strong>Resonance</strong> fills when you stand still or sneak—then <strong>Space</strong> can unleash a <em>harmonic</em> twin-ring ping. Loud moves, pings, and throws bank <strong>Echo heat</strong>; hunters run hotter when heat is high. Keep heat low to build a <strong>silence dividend</strong> (+Resonance). Find the <strong>echo key</strong> or the exit hums shut.</p>
      <fieldset class="settings-field">
        <legend>Settings</legend>
        <label class="field">Mouse sensitivity
          <input type="range" id="set-mouse-menu" min="0.35" max="2.5" step="0.05" value="1" />
        </label>
        <label class="field">Volume
          <input type="range" id="set-vol-menu" min="0" max="1" step="0.01" value="0.85" />
        </label>
        <label class="field tick">
          <input type="checkbox" id="set-hud-menu" checked /> Show control hints in-game
        </label>
      </fieldset>
      <p class="fine">Use headphones. Click <strong>Begin</strong> and allow audio if prompted.</p>
      <div class="btn-row">
        <button type="button" id="btn-start" class="btn-primary">Begin</button>
      </div>
      <p class="credits">A WebGL study · Three.js · procedural audio</p>
    </div>

    <div class="panel hidden" id="panel-pause" role="dialog" aria-labelledby="pause-title">
      <h2 id="pause-title">Paused</h2>
      <fieldset class="settings-field">
        <legend>Settings</legend>
        <label class="field">Mouse sensitivity
          <input type="range" id="set-mouse-pause" min="0.35" max="2.5" step="0.05" />
        </label>
        <label class="field">Volume
          <input type="range" id="set-vol-pause" min="0" max="1" step="0.01" />
        </label>
        <label class="field tick">
          <input type="checkbox" id="set-hud-pause" /> Show control hints
        </label>
      </fieldset>
      <div class="btn-row split">
        <button type="button" id="btn-resume" class="btn-primary">Resume</button>
        <button type="button" id="btn-restart-pause" class="btn-ghost">Restart run</button>
      </div>
      <button type="button" id="btn-title-pause" class="btn-text">Return to title</button>
    </div>

    <div class="panel hidden" id="panel-won" role="dialog" aria-labelledby="won-title">
      <h2 id="won-title">Escaped</h2>
      <p id="won-stats" class="stats" aria-live="polite"></p>
      <p>You read the echoes well enough to slip past the gate.</p>
      <div class="btn-row split">
        <button type="button" id="btn-again-win" class="btn-primary">Play again</button>
        <button type="button" id="btn-title-win" class="btn-ghost">Title</button>
      </div>
    </div>

    <div class="panel hidden" id="panel-lost" role="dialog" aria-labelledby="lost-title">
      <h2 id="lost-title">Caught</h2>
      <p id="lost-stats" class="stats" aria-live="polite"></p>
      <p>Hunters converged on your last loud footprint or ping.</p>
      <div class="btn-row split">
        <button type="button" id="btn-again-lost" class="btn-primary">Retry</button>
        <button type="button" id="btn-title-lost" class="btn-ghost">Title</button>
      </div>
    </div>
  `;

  wrap.appendChild(crosshair);
  wrap.appendChild(hud);
  wrap.appendChild(overlay);
  root.appendChild(wrap);

  const hudHints = hud.querySelector<HTMLDivElement>("#hud-hints")!;
  const hudTime = hud.querySelector<HTMLSpanElement>("#hud-time")!;
  const hudSector = hud.querySelector<HTMLSpanElement>("#hud-sector")!;
  const meterRes = hud.querySelector<HTMLDivElement>("#meter-res")!;
  const meterDebt = hud.querySelector<HTMLDivElement>("#meter-debt")!;
  const panelMenu = overlay.querySelector<HTMLDivElement>("#panel-menu")!;
  const panelPause = overlay.querySelector<HTMLDivElement>("#panel-pause")!;
  const panelWon = overlay.querySelector<HTMLDivElement>("#panel-won")!;
  const panelLost = overlay.querySelector<HTMLDivElement>("#panel-lost")!;
  const wonStats = overlay.querySelector<HTMLParagraphElement>("#won-stats")!;
  const lostStats = overlay.querySelector<HTMLParagraphElement>("#lost-stats")!;

  const btnStart = overlay.querySelector<HTMLButtonElement>("#btn-start")!;
  const btnResume = overlay.querySelector<HTMLButtonElement>("#btn-resume")!;
  const btnRestartPause = overlay.querySelector<HTMLButtonElement>("#btn-restart-pause")!;
  const btnTitlePause = overlay.querySelector<HTMLButtonElement>("#btn-title-pause")!;
  const btnAgainWin = overlay.querySelector<HTMLButtonElement>("#btn-again-win")!;
  const btnTitleWin = overlay.querySelector<HTMLButtonElement>("#btn-title-win")!;
  const btnAgainLost = overlay.querySelector<HTMLButtonElement>("#btn-again-lost")!;
  const btnTitleLost = overlay.querySelector<HTMLButtonElement>("#btn-title-lost")!;

  const setMouseMenu = overlay.querySelector<HTMLInputElement>("#set-mouse-menu")!;
  const setVolMenu = overlay.querySelector<HTMLInputElement>("#set-vol-menu")!;
  const setHudMenu = overlay.querySelector<HTMLInputElement>("#set-hud-menu")!;
  const setMousePause = overlay.querySelector<HTMLInputElement>("#set-mouse-pause")!;
  const setVolPause = overlay.querySelector<HTMLInputElement>("#set-vol-pause")!;
  const setHudPause = overlay.querySelector<HTMLInputElement>("#set-hud-pause")!;

  const keys = new Set<string>();
  let pointerLocked = false;
  let dragLook = false;
  let lastMouse = { x: 0, y: 0 };
  let lastTouch: { x: number; y: number } | null = null;

  function applySettingsToInputs(): void {
    setMouseMenu.value = String(settings.mouseSensitivity);
    setVolMenu.value = String(settings.masterVolume);
    setHudMenu.checked = settings.showHudHints;
    setMousePause.value = String(settings.mouseSensitivity);
    setVolPause.value = String(settings.masterVolume);
    setHudPause.checked = settings.showHudHints;
  }

  function applySettingsToGame(): void {
    game.mouseLookMul = settings.mouseSensitivity;
    audio.ensure();
    audio.setMasterVolume(settings.masterVolume);
    const hideHints = !settings.showHudHints && game.phase === "playing";
    hudHints.classList.toggle("hidden", hideHints);
  }

  function wireMirrorRanges(
    a: HTMLInputElement,
    b: HTMLInputElement,
    key: "mouseSensitivity" | "masterVolume",
  ): void {
    const push = (src: HTMLInputElement): void => {
      const v = parseFloat(src.value);
      settings[key] = v;
      a.value = String(v);
      b.value = String(v);
      saveSettings(settings);
      applySettingsToGame();
    };
    a.addEventListener("input", () => push(a));
    b.addEventListener("input", () => push(b));
  }

  wireMirrorRanges(setMouseMenu, setMousePause, "mouseSensitivity");
  wireMirrorRanges(setVolMenu, setVolPause, "masterVolume");

  function wireMirrorHud(a: HTMLInputElement, b: HTMLInputElement): void {
    const push = (src: HTMLInputElement): void => {
      settings.showHudHints = src.checked;
      a.checked = src.checked;
      b.checked = src.checked;
      saveSettings(settings);
      applySettingsToGame();
    };
    a.addEventListener("change", () => push(a));
    b.addEventListener("change", () => push(b));
  }

  wireMirrorHud(setHudMenu, setHudPause);

  applySettingsToInputs();
  applySettingsToGame();

  function showOverlay(which: "menu" | "pause" | "won" | "lost" | "none"): void {
    panelMenu.classList.toggle("hidden", which !== "menu");
    panelPause.classList.toggle("hidden", which !== "pause");
    panelWon.classList.toggle("hidden", which !== "won");
    panelLost.classList.toggle("hidden", which !== "lost");
    overlay.classList.toggle("hidden", which === "none");
    const hideHud = which === "menu" || which === "won" || which === "lost";
    hud.classList.toggle("hidden", hideHud);
    crosshair.classList.toggle("hidden", hideHud);
    if (which === "won" || which === "lost") updateEndStats();
  }

  function updateEndStats(): void {
    const s = game.lastRunSummary;
    const line = s
      ? `Time ${formatTimeShort(s.timeSec)} · ${s.pings} pings (${s.harmonics} harmonic) · ${s.throws} throws · heat ${Math.round(s.echoDebt * 100)}% · ${s.silenceBonuses} silence bonuses`
      : "";
    wonStats.textContent = line;
    lostStats.textContent = line;
  }

  function syncPanels(): void {
    if (game.phase === "menu") showOverlay("menu");
    else if (game.phase === "paused") {
      applySettingsToInputs();
      showOverlay("pause");
    } else if (game.phase === "won") showOverlay("won");
    else if (game.phase === "lost") showOverlay("lost");
    else showOverlay("none");
    applySettingsToGame();
  }

  async function begin(): Promise<void> {
    await audio.resume();
    audio.setMasterVolume(settings.masterVolume);
    game.startPlaying();
    syncPanels();
    await game.renderer.domElement.requestPointerLock().catch(() => {});
  }

  btnStart.addEventListener("click", () => void begin());
  btnResume.addEventListener("click", () => {
    game.phase = "playing";
    syncPanels();
    void game.renderer.domElement.requestPointerLock().catch(() => {});
  });
  btnRestartPause.addEventListener("click", () => {
    game.resetLevel();
    syncPanels();
    void game.renderer.domElement.requestPointerLock().catch(() => {});
  });
  btnTitlePause.addEventListener("click", () => {
    game.goToMenu();
    syncPanels();
    document.exitPointerLock();
  });
  btnAgainWin.addEventListener("click", () => void begin());
  btnAgainLost.addEventListener("click", () => void begin());
  btnTitleWin.addEventListener("click", () => {
    game.goToMenu();
    syncPanels();
  });
  btnTitleLost.addEventListener("click", () => {
    game.goToMenu();
    syncPanels();
  });

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);

    if (e.code === "Escape") {
      if (game.phase === "playing") {
        game.phase = "paused";
        syncPanels();
        document.exitPointerLock();
      } else if (game.phase === "paused") {
        game.phase = "playing";
        syncPanels();
        void game.renderer.domElement.requestPointerLock().catch(() => {});
      }
      return;
    }

    if (e.repeat) return;

    if (game.phase === "playing") {
      if (e.code === "Space") {
        e.preventDefault();
        game.tryPing();
      }
      if (e.code === "KeyR") {
        game.resetLevel();
      }
      if (e.code === "KeyF") {
        const dir = game.getForwardDirection();
        game.tryThrow(dir.x, dir.z);
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });

  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === game.renderer.domElement;
  });

  game.renderer.domElement.addEventListener("mousedown", (e) => {
    if (game.phase !== "playing") return;
    if (e.button === 0) {
      dragLook = true;
      lastMouse = { x: e.clientX, y: e.clientY };
      void game.renderer.domElement.requestPointerLock().catch(() => {});
    }
  });

  window.addEventListener("mouseup", () => {
    dragLook = false;
  });

  window.addEventListener("mousemove", (e) => {
    if (game.phase !== "playing") return;
    if (pointerLocked) {
      game.addMouseLook(e.movementX, e.movementY);
    } else if (dragLook) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      lastMouse = { x: e.clientX, y: e.clientY };
      game.addMouseLook(dx, dy);
    }
  });

  game.renderer.domElement.addEventListener(
    "touchstart",
    (e) => {
      if (game.phase !== "playing") return;
      if (e.touches.length === 1) {
        const t = e.touches[0]!;
        lastTouch = { x: t.clientX, y: t.clientY };
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (game.phase !== "playing" || !lastTouch || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      const dx = t.clientX - lastTouch.x;
      const dy = t.clientY - lastTouch.y;
      lastTouch = { x: t.clientX, y: t.clientY };
      game.addMouseLook(dx * 1.35, dy * 1.35);
      e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener("touchend", () => {
    lastTouch = null;
  });

  game.renderer.domElement.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && game.phase === "playing") {
      game.phase = "paused";
      syncPanels();
      document.exitPointerLock();
    }
  });

  game.renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    root.innerHTML = `
      <div class="fatal">
        <h1>Graphics context lost</h1>
        <p>The GPU reset or the tab slept too long. Reload the page to continue.</p>
        <button type="button" id="ctx-reload">Reload</button>
      </div>`;
    root.querySelector("#ctx-reload")?.addEventListener("click", () => location.reload());
  });

  let last = performance.now();
  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;

    const phaseBefore = game.phase;
    if (game.phase === "playing") {
      const forward = keys.has("KeyW") || keys.has("ArrowUp");
      const back = keys.has("KeyS") || keys.has("ArrowDown");
      const left = keys.has("KeyA") || keys.has("ArrowLeft");
      const right = keys.has("KeyD") || keys.has("ArrowRight");
      const stealth = keys.has("ShiftLeft") || keys.has("ShiftRight");
      game.tick(dt, forward, back, left, right, stealth);
      hudTime.textContent = formatTimeShort(game.simulationTime);
      const g = game.getPlayerGrid();
      hudSector.textContent = `Sector ${g.ix},${g.iz}`;
      meterRes.style.width = `${game.resonance}%`;
      meterDebt.style.width = `${Math.min(100, game.echoDebt * 100)}%`;
    }

    if (game.phase !== phaseBefore) {
      if (game.phase === "won" || game.phase === "lost") {
        document.exitPointerLock();
      }
      syncPanels();
    }

    game.render();
  }
  requestAnimationFrame(frame);

  window.addEventListener("resize", () => {
    game.resize(window.innerWidth, window.innerHeight);
  });

  syncPanels();
}
