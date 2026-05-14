import { MAX_MISSION_LEVEL, missionOptions } from "./campaign";
import { THEMES } from "./settings";

export interface UiRefs {
  wrap: HTMLDivElement;
  overlay: HTMLDivElement;
  hud: HTMLDivElement;
  crosshair: HTMLDivElement;
  radar: HTMLCanvasElement;
  hudHints: HTMLDivElement;
  hudTime: HTMLSpanElement;
  hudSector: HTMLSpanElement;
  hudObjective: HTMLParagraphElement;
  meterRes: HTMLDivElement;
  meterDebt: HTMLDivElement;
  keyChip: HTMLSpanElement;
  missionChip: HTMLSpanElement;
  mpChip: HTMLSpanElement;
  campaignProgress: HTMLParagraphElement;
  panelMenu: HTMLDivElement;
  panelPause: HTMLDivElement;
  panelWon: HTMLDivElement;
  panelLost: HTMLDivElement;
  wonStats: HTMLParagraphElement;
  lostStats: HTMLParagraphElement;
  btnStart: HTMLButtonElement;
  btnResume: HTMLButtonElement;
  btnRestartPause: HTMLButtonElement;
  btnTitlePause: HTMLButtonElement;
  btnAgainWin: HTMLButtonElement;
  btnTitleWin: HTMLButtonElement;
  btnAgainLost: HTMLButtonElement;
  btnTitleLost: HTMLButtonElement;
  btnLocal: HTMLButtonElement;
  btnRelay: HTMLButtonElement;
  btnDisconnect: HTMLButtonElement;
  live: HTMLDivElement;
  inputs: Record<string, HTMLInputElement | HTMLSelectElement>;
}

export function buildUi(root: HTMLDivElement, canvas: HTMLCanvasElement): UiRefs {
  const wrap = document.createElement("div");
  wrap.className = "game-wrap";
  wrap.appendChild(canvas);

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
    <p id="hud-objective" class="hud-objective">Read echoes. Reach the exit.</p>
    <div class="hud-meters" aria-hidden="true">
      <div class="meter-row"><span class="meter-name">Resonance</span><div class="meter-track"><div id="meter-res" class="meter-fill res"></div></div></div>
      <div class="meter-row"><span class="meter-name heat">Echo heat</span><div class="meter-track"><div id="meter-debt" class="meter-fill debt"></div></div></div>
    </div>
    <div class="chip-row"><span id="mission-chip" class="chip">Mission 1/${MAX_MISSION_LEVEL}</span><span id="key-chip" class="chip">Key: missing</span><span id="mp-chip" class="chip">Single player</span></div>
    <div id="hud-hints" class="hud-body">
      <p class="hud-line"><kbd>WASD</kbd> move · <kbd>Shift</kbd> quiet · <kbd>Space</kbd> ping · <kbd>Q</kbd> focus scan · <kbd>E</kbd> beacon · <kbd>F</kbd> throw · <kbd>R</kbd> restart · <kbd>Esc</kbd> pause</p>
      <p class="hud-tip">Use sound to see. Ringwells amplify footsteps; violet walls lie. Low heat pays Resonance. Beacons distract hunters but add noise.</p>
    </div>`;

  const radar = document.createElement("canvas");
  radar.id = "radar";
  radar.className = "radar";
  radar.setAttribute("aria-label", "Local echo radar");

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `${menuPanel()}${pausePanel()}${endPanel("won", "Escaped", "You read the maze, kept your nerve, and found the gate.")}${endPanel("lost", "Caught", "The hunters converged on your noise trail.")}`;

  wrap.append(crosshair, hud, radar, overlay);
  root.appendChild(wrap);
  const q = <T extends Element>(sel: string): T => {
    const el = wrap.querySelector<T>(sel);
    if (!el) throw new Error(`${sel} missing`);
    return el;
  };
  const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};
  wrap.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => { inputs[el.id] = el; });
  return {
    wrap, overlay, hud, crosshair, radar,
    hudHints: q("#hud-hints"), hudTime: q("#hud-time"), hudSector: q("#hud-sector"), hudObjective: q("#hud-objective"),
    meterRes: q("#meter-res"), meterDebt: q("#meter-debt"), keyChip: q("#key-chip"), missionChip: q("#mission-chip"), mpChip: q("#mp-chip"), campaignProgress: q("#campaign-progress"),
    panelMenu: q("#panel-menu"), panelPause: q("#panel-pause"), panelWon: q("#panel-won"), panelLost: q("#panel-lost"),
    wonStats: q("#won-stats"), lostStats: q("#lost-stats"), btnStart: q("#btn-start"), btnResume: q("#btn-resume"),
    btnRestartPause: q("#btn-restart-pause"), btnTitlePause: q("#btn-title-pause"), btnAgainWin: q("#btn-again-win"), btnTitleWin: q("#btn-title-win"),
    btnAgainLost: q("#btn-again-lost"), btnTitleLost: q("#btn-title-lost"), btnLocal: q("#btn-local"), btnRelay: q("#btn-relay"),
    btnDisconnect: q("#btn-disconnect"), live: q("#live-region"), inputs,
  };
}

function menuPanel(): string {
  return `<div class="panel panel-wide" id="panel-menu" role="dialog" aria-labelledby="menu-title">
    <p class="tagline">Sonar stealth · procedural horror · frontend-only multiplayer shell</p>
    <h1 id="menu-title">Echo Maze <span>Overdrive</span></h1>
    <p class="lead">Navigate a living dark maze with echoes, decoys, focus scans, beacon lures, adaptive audio, radar, accessibility themes, and optional peer ghosts.</p>
    <div class="feature-grid" aria-label="New features">
      <span>Focus scan</span><span>Echo beacons</span><span>Adaptive ambience</span><span>Radar</span><span>High contrast</span><span>Peer ghosts</span>
    </div>
    ${missionMarkup()}
    ${settingsMarkup("menu")}
    ${multiplayerMarkup()}
    <p class="fine">WebSocket mode is client-only: enter a relay that broadcasts room messages. Local mode works across same-origin tabs with no server.</p>
    <div class="btn-row"><button type="button" id="btn-start" class="btn-primary">Begin mission</button></div>
    <p class="credits">Three.js · WebGL2 · Web Audio · localStorage · BroadcastChannel/WebSocket adapters</p>
  </div>`;
}

function missionMarkup(): string {
  return `<fieldset class="settings-field mission"><legend>Single-player campaign</legend>
    <label class="field">Mission difficulty<select id="mission-level">${missionOptions(1, 1)}</select></label>
    <label class="field">Mode<select id="play-mode"><option value="single">Single player</option><option value="ghosts">Multiplayer ghosts</option></select></label>
    <p id="campaign-progress" class="fine">33 missions. Complete the current mission to proceed to the next level.</p>
  </fieldset>`;
}

function pausePanel(): string {
  return `<div class="panel hidden" id="panel-pause" role="dialog" aria-labelledby="pause-title">
    <h2 id="pause-title">Paused</h2>
    ${settingsMarkup("pause")}
    <div class="btn-row split"><button type="button" id="btn-resume" class="btn-primary">Resume</button><button type="button" id="btn-restart-pause" class="btn-ghost">Restart run</button></div>
    <button type="button" id="btn-title-pause" class="btn-text">Return to title</button>
  </div>`;
}

function settingsMarkup(scope: "menu" | "pause"): string {
  const themeOptions = THEMES.map((t) => `<option value="${t.id}">${t.label} — ${t.note}</option>`).join("");
  return `<fieldset class="settings-field"><legend>Settings</legend>
    <label class="field">Theme<select id="set-theme-${scope}">${themeOptions}</select></label>
    <label class="field">Mouse sensitivity<input type="range" id="set-mouse-${scope}" min="0.35" max="2.5" step="0.05" /></label>
    <label class="field">Master volume<input type="range" id="set-vol-${scope}" min="0" max="1" step="0.01" /></label>
    <label class="field">SFX volume<input type="range" id="set-sfx-${scope}" min="0" max="1" step="0.01" /></label>
    <label class="field">Ambience<input type="range" id="set-amb-${scope}" min="0" max="1" step="0.01" /></label>
    <label class="field tick"><input type="checkbox" id="set-hud-${scope}" /> Show hints</label>
    <label class="field tick"><input type="checkbox" id="set-radar-${scope}" /> Show radar</label>
    <label class="field tick"><input type="checkbox" id="set-assist-${scope}" /> Visual assist / brighter baseline</label>
  </fieldset>`;
}

function multiplayerMarkup(): string {
  return `<fieldset class="settings-field multiplayer"><legend>Multiplayer / spectator ghosts</legend>
    <label class="field">Name<input type="text" id="mp-name" maxlength="24" autocomplete="nickname" /></label>
    <label class="field">Room<input type="text" id="mp-room" maxlength="32" /></label>
    <label class="field">WebSocket relay URL<input type="url" id="mp-url" placeholder="wss://your-relay.example/ws" /></label>
    <div class="btn-row split"><button type="button" id="btn-local" class="btn-ghost">Local tabs</button><button type="button" id="btn-relay" class="btn-ghost">Connect relay</button><button type="button" id="btn-disconnect" class="btn-text">Disconnect</button></div>
    <div id="live-region" class="live" aria-live="polite">Offline</div>
  </fieldset>`;
}

function endPanel(kind: "won" | "lost", title: string, body: string): string {
  const cap = kind[0]!.toUpperCase() + kind.slice(1);
  const actionId = kind === "won" ? "win" : "lost";
  return `<div class="panel hidden" id="panel-${kind}" role="dialog" aria-labelledby="${kind}-title">
    <h2 id="${kind}-title">${title}</h2><p id="${kind}-stats" class="stats" aria-live="polite"></p><p>${body}</p>
    <div class="btn-row split"><button type="button" id="btn-again-${actionId}" class="btn-primary">${kind === "won" ? "Next mission" : "Retry"}</button><button type="button" id="btn-title-${actionId}" class="btn-ghost">Title</button></div>
    <p class="fine">${cap} runs save only in this browser.</p>
  </div>`;
}
