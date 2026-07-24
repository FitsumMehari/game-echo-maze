import { html } from "./dom";

export function panelShell(id: string, titleId: string, titleHtml: string, bodyHtml: string, hidden = false): string {
  return html`<div
    class="panel${hidden ? " hidden" : ""}${id === "panel-menu" ? " panel-wide" : ""}"
    id="${id}"
    role="dialog"
    aria-labelledby="${titleId}"
  >
    ${titleHtml} ${bodyHtml}
  </div>`;
}

export function toastHost(): string {
  return html`<div id="toast-host" class="toast-host" aria-live="polite"></div>`;
}

export function vignetteLayer(): string {
  return html`<div id="juice-vignette" class="juice-vignette" aria-hidden="true"></div>`;
}

export function loadingScreen(): string {
  return html`<div id="boot-loading" class="boot-loading" role="status">
    <div class="boot-rings" aria-hidden="true"></div>
    <div class="boot-mark">Echo Maze</div>
    <p class="boot-sub">Calibrating sonar…</p>
  </div>`;
}

export function contentWarningPanel(): string {
  return panelShell(
    "panel-warn",
    "warn-title",
    html`<h2 id="warn-title">Sensory notice</h2>`,
    html`<p>
        This game uses darkness, sudden audio stingers, and expanding flash rings. Photosensitive players should enable
        Flash reduce and Visual assist in Settings.
      </p>
      <div class="btn-row"><button type="button" id="btn-warn-ok" class="btn-primary">I understand</button></div>`,
    true,
  );
}

export function tutorialPanel(): string {
  return panelShell(
    "panel-tutorial",
    "tut-title",
    html`<h2 id="tut-title">Sonar briefing</h2>`,
    html`<ol class="tut-steps">
        <li><kbd>WASD</kbd> move · <kbd>Shift</kbd> quiet steps (less heat).</li>
        <li><kbd>Space</kbd> ping reveals walls — and alerts hunters.</li>
        <li>Build Resonance by staying quiet; spend it on Focus (<kbd>Q</kbd>) or Beacon (<kbd>E</kbd>).</li>
        <li>Collect the echo key, open sealed doors via switches, reach the green gate.</li>
      </ol>
      <div class="btn-row"><button type="button" id="btn-tut-ok" class="btn-primary">Begin training</button></div>`,
    true,
  );
}
