import { MAX_MISSION_LEVEL, missionOptions } from "@/systems/campaign";
import { THEMES } from "@/systems/settings";
import { DIFFICULTIES } from "@/systems/difficulty";
import { MUTATORS } from "@/systems/mutators";
import { ACHIEVEMENTS } from "@/systems/achievements";
import { dailyKey } from "@/systems/dailyChallenge";
import { button, btnRow, checkField, fieldset, rangeField, selectField, textField } from "../components/fields";
import { html } from "../components/dom";

const BASE = import.meta.env.BASE_URL;

export function missionFieldset(): string {
  const diffOpts = DIFFICULTIES.map((d) => `<option value="${d.id}">${d.label} — ${d.note}</option>`).join("");
  const mutOpts = MUTATORS.map((m) => `<option value="${m.id}">${m.label} — ${m.note}</option>`).join("");
  return fieldset(
    "Campaign",
    [
      selectField("mission-level", "Mission", missionOptions(1, 1)),
      selectField(
        "play-mode",
        "Mode",
        `<option value="single">Single player</option><option value="ghosts">Ghost multiplayer</option><option value="daily">Daily challenge (${dailyKey()})</option>`,
      ),
      selectField("set-difficulty", "Difficulty", diffOpts),
      selectField("set-mutator", "Mutator (post-finale)", mutOpts),
      html`<p id="campaign-progress" class="fine">33 named sectors. Complete missions to unlock the next.</p>`,
      html`<p id="best-times-line" class="fine">Personal bests appear beside each mission.</p>`,
    ].join(""),
    "settings-field mission",
  );
}

export function audioVisualFieldset(scope: "menu" | "pause"): string {
  const themeOptions = THEMES.map((t) => `<option value="${t.id}">${t.label} — ${t.note}</option>`).join("");
  return fieldset(
    "Audio & visual",
    [
      selectField(`set-theme-${scope}`, "Theme", themeOptions),
      rangeField(`set-mouse-${scope}`, "Mouse sensitivity", 0.35, 2.5, 0.05),
      rangeField(`set-vol-${scope}`, "Master volume", 0, 1, 0.01),
      rangeField(`set-sfx-${scope}`, "SFX volume", 0, 1, 0.01),
      rangeField(`set-amb-${scope}`, "Ambience", 0, 1, 0.01),
      selectField(
        `set-quality-${scope}`,
        "Quality",
        `<option value="high">High</option><option value="med">Medium</option><option value="low">Low</option>`,
      ),
      checkField(`set-hud-${scope}`, "Show hints"),
      checkField(`set-radar-${scope}`, "Show radar"),
      checkField(`set-assist-${scope}`, "Visual assist"),
      checkField(`set-headphones-${scope}`, "Headphones spatial mode"),
      checkField(`set-flash-${scope}`, "Flash / ring reduce"),
      checkField(`set-mic-${scope}`, "Mic noise → heat (optional)"),
    ].join(""),
  );
}

export function controlsFieldset(): string {
  return fieldset(
    "Controls & system",
    [
      textField("set-forward-code", "Move forward", { placeholder: "KeyW" }),
      textField("set-back-code", "Move back", { placeholder: "KeyS" }),
      textField("set-left-code", "Move left", { placeholder: "KeyA" }),
      textField("set-right-code", "Move right", { placeholder: "KeyD" }),
      textField("set-stealth-code", "Stealth", { placeholder: "ShiftLeft" }),
      textField("set-ping-code", "Ping", { placeholder: "Space" }),
      textField("set-focus-code", "Focus", { placeholder: "KeyQ" }),
      textField("set-beacon-code", "Beacon", { placeholder: "KeyE" }),
      textField("set-throw-code", "Throw", { placeholder: "KeyF" }),
      textField("set-restart-code", "Restart", { placeholder: "KeyR" }),
      html`<p class="fine">Click a field then press a key. Esc always pauses.</p>`,
      btnRow(
        button("btn-fullscreen", "Fullscreen") +
          button("btn-export-save", "Export save") +
          button("btn-import-save", "Import save"),
        true,
      ),
    ].join(""),
  );
}

export function multiplayerFieldset(): string {
  return fieldset(
    "Ghost multiplayer (cosmetic peers)",
    [
      textField("mp-name", "Name", { max: 24, autocomplete: "nickname" }),
      textField("mp-room", "Room", { max: 32 }),
      textField("mp-url", "WebSocket relay URL", { type: "url", placeholder: "wss://your-relay.example/ws" }),
      btnRow(
        [
          button("btn-local", "Local tabs"),
          button("btn-relay", "Connect relay"),
          button("btn-disconnect", "Disconnect", "text"),
        ].join(""),
        true,
      ),
      html`<div id="live-region" class="live" aria-live="polite">Offline</div>`,
      html`<p class="fine">Peers are echo ghosts only — not authoritative.</p>`,
    ].join(""),
    "settings-field multiplayer",
  );
}

export function achievementsFieldset(): string {
  const items = ACHIEVEMENTS.map(
    (a) => `<li data-ach="${a.id}" class="ach-off"><strong>${a.title}</strong> — ${a.hint}</li>`,
  ).join("");
  return fieldset(
    "Achievements",
    html`<ul id="ach-list" class="ach-list">
      ${items}
    </ul>`,
  );
}

function settingsTabs(scope: "menu" | "pause"): string {
  const ids =
    scope === "menu"
      ? [
          ["tab-play", "Play", missionFieldset()],
          ["tab-audio", "Audio / look", audioVisualFieldset("menu")],
          ["tab-controls", "Controls", controlsFieldset()],
          ["tab-social", "Peers", multiplayerFieldset()],
          ["tab-ach", "Achievements", achievementsFieldset()],
        ]
      : [["tab-pause-audio", "Audio / look", audioVisualFieldset("pause")]];
  const buttons = ids
    .map(
      ([id, label], i) =>
        `<button type="button" class="tab-btn" role="tab" data-tab="${id}" aria-selected="${i === 0 ? "true" : "false"}">${label}</button>`,
    )
    .join("");
  const panels = ids
    .map(
      ([id, , body], i) =>
        `<div class="tab-panel${i === 0 ? "" : " hidden"}" data-tab-panel="${id}" role="tabpanel">${body}</div>`,
    )
    .join("");
  return html`<div class="settings-tabs" role="tablist">${buttons}</div>
    ${panels}`;
}

export function menuPanelHtml(): string {
  return html`<div class="panel panel-wide panel-hero" id="panel-menu" role="dialog" aria-labelledby="menu-title">
    <div class="brand-mark" aria-hidden="true"><img src="${BASE}icons/ping.svg" alt="" /></div>
    <p class="tagline">Sonar stealth · campaign · browser-native</p>
    <h1 id="menu-title">Echo Maze<span class="overdrive">Overdrive</span></h1>
    <p class="lead">Navigate darkness with echoes. Noise maps the maze — and feeds the hunters.</p>
    <div class="feature-row" aria-label="Highlights">
      <span>33 sectors</span><span>Pathfinding hunters</span><span>Spatial audio</span><span>Daily seed</span>
    </div>
    ${settingsTabs("menu")}
    ${btnRow(
      button("btn-start", "Begin mission", "primary") +
        button("btn-resume-save", "Resume run") +
        button("btn-share-menu", "Share"),
    )}
    <p class="credits">Vite · Three.js · Web Audio · free fonts Syne + IBM Plex Mono</p>
  </div>`;
}

export function pausePanelHtml(): string {
  return html`<div class="panel hidden" id="panel-pause" role="dialog" aria-labelledby="pause-title">
    <h2 id="pause-title">Paused</h2>
    ${settingsTabs("pause")}
    ${btnRow(button("btn-resume", "Resume", "primary") + button("btn-restart-pause", "Restart run"), true)}
    ${button("btn-title-pause", "Return to title", "text")}
  </div>`;
}

export function endPanelHtml(kind: "won" | "lost", title: string, body: string): string {
  const actionId = kind === "won" ? "win" : "lost";
  return html`<div
    class="panel panel-hero panel-${kind} hidden"
    id="panel-${kind}"
    role="dialog"
    aria-labelledby="${kind}-title"
  >
    <div class="end-burst" aria-hidden="true"></div>
    <h2 id="${kind}-title">${title}</h2>
    <p id="${kind}-grade" class="grade" aria-live="polite"></p>
    <p id="${kind}-stats" class="stats" aria-live="polite"></p>
    <p id="${kind}-tip" class="fine"></p>
    <p>${body}</p>
    ${btnRow(
      button(`btn-again-${actionId}`, kind === "won" ? "Next mission" : "Retry", "primary") +
        button(`btn-share-${actionId}`, "Share run") +
        button(`btn-title-${actionId}`, "Title"),
      true,
    )}
  </div>`;
}

export function hudHtml(): string {
  return html`<div class="hud">
    <div class="hud-top">
      <span id="hud-time" class="hud-time" role="timer" aria-live="polite">0:00</span>
      <span id="hud-sector" class="hud-sector" aria-hidden="true"></span>
      <span class="hud-brand">Echo Maze</span>
    </div>
    <div class="hud-mid">
      <p id="hud-objective" class="hud-objective">Read echoes. Reach the exit.</p>
      <div class="hud-meters" aria-hidden="true">
        <div class="meter-row">
          <span class="meter-name">Resonance</span>
          <div class="meter-track"><div id="meter-res" class="meter-fill res"></div></div>
        </div>
        <div class="meter-row">
          <span class="meter-name heat">Echo heat</span>
          <div class="meter-track"><div id="meter-debt" class="meter-fill debt"></div></div>
        </div>
        <div class="meter-row threat">
          <span class="meter-name">Threat</span>
          <div class="meter-track"><div id="meter-threat" class="meter-fill threat"></div></div>
        </div>
      </div>
      <div class="chip-row">
        <span id="mission-chip" class="chip">Mission 1/${MAX_MISSION_LEVEL}</span>
        <span id="key-chip" class="chip">Key: missing</span>
        <span id="door-chip" class="chip hidden">Seal open</span>
        <span id="mp-chip" class="chip">Single player</span>
      </div>
      <div id="hud-hints" class="hud-hints">
        <p class="hud-line">
          <kbd>WASD</kbd> · <kbd>Shift</kbd> quiet · <kbd>Space</kbd> ping · <kbd>Q</kbd> focus · <kbd>E</kbd> beacon ·
          <kbd>F</kbd> throw · <kbd>Esc</kbd>
        </p>
        <p class="hud-tip">Sound is sight. Silence pays Resonance. Beacons lure hunters.</p>
      </div>
    </div>
  </div>`;
}

export function abilityDockHtml(): string {
  return html`<div class="ability-dock hidden" aria-hidden="true">
    <div class="ability ready" id="ability-ping" data-ability="ping">
      <img src="${BASE}icons/ping.svg" alt="" /><span class="ability-key">SPC</span
      ><span class="ability-cd" id="cd-ping"></span>
    </div>
    <div class="ability ready" id="ability-focus" data-ability="focus">
      <img src="${BASE}icons/focus.svg" alt="" /><span class="ability-key">Q</span
      ><span class="ability-cd" id="cd-focus"></span>
    </div>
    <div class="ability ready" id="ability-beacon" data-ability="beacon">
      <img src="${BASE}icons/beacon.svg" alt="" /><span class="ability-key">E</span
      ><span class="ability-cd" id="cd-beacon"></span>
    </div>
    <div class="ability ready" id="ability-throw" data-ability="throw">
      <img src="${BASE}icons/throw.svg" alt="" /><span class="ability-key">F</span
      ><span class="ability-cd" id="cd-throw"></span>
    </div>
  </div>`;
}

export function threatCompassHtml(): string {
  return html`<div id="threat-compass" class="threat-compass hidden" aria-hidden="true">
    <div class="threat-compass-ring"></div>
    <div id="threat-wedge" class="threat-wedge"></div>
  </div>`;
}

export function mobileControlsHtml(): string {
  return html`<div id="mobile-controls" class="mobile-controls" aria-label="Touch controls">
    <div class="stick-zone" id="stick-zone"><div class="stick-knob" id="stick-knob"></div></div>
    <div class="action-pad">
      <button type="button" class="mob-btn" data-act="ping" aria-label="Ping">Ping</button>
      <button type="button" class="mob-btn" data-act="focus" aria-label="Focus">Q</button>
      <button type="button" class="mob-btn" data-act="beacon" aria-label="Beacon">E</button>
      <button type="button" class="mob-btn" data-act="throw" aria-label="Throw">F</button>
      <button type="button" class="mob-btn stealth" data-act="stealth" aria-label="Stealth">Shift</button>
    </div>
  </div>`;
}
