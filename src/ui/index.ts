import { qs } from "./components/dom";
import { contentWarningPanel, loadingScreen, toastHost, tutorialPanel, vignetteLayer } from "./components/panels";
import {
  abilityDockHtml,
  endPanelHtml,
  hudHtml,
  menuPanelHtml,
  mobileControlsHtml,
  pausePanelHtml,
  threatCompassHtml,
} from "./panels/shell";
import { loadAchievements } from "@/systems/achievements";

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
  meterThreat: HTMLDivElement;
  keyChip: HTMLSpanElement;
  doorChip: HTMLSpanElement;
  missionChip: HTMLSpanElement;
  mpChip: HTMLSpanElement;
  campaignProgress: HTMLParagraphElement;
  bestTimesLine: HTMLParagraphElement;
  panelMenu: HTMLDivElement;
  panelPause: HTMLDivElement;
  panelWon: HTMLDivElement;
  panelLost: HTMLDivElement;
  panelWarn: HTMLDivElement;
  panelTutorial: HTMLDivElement;
  bootLoading: HTMLDivElement;
  juiceVignette: HTMLDivElement;
  pingFlash: HTMLDivElement;
  toastHost: HTMLDivElement;
  mobileControls: HTMLDivElement;
  threatCompass: HTMLDivElement;
  threatWedge: HTMLDivElement;
  abilityDock: HTMLDivElement;
  abilityPing: HTMLDivElement;
  abilityFocus: HTMLDivElement;
  abilityBeacon: HTMLDivElement;
  abilityThrow: HTMLDivElement;
  cdPing: HTMLSpanElement;
  cdFocus: HTMLSpanElement;
  wonStats: HTMLParagraphElement;
  lostStats: HTMLParagraphElement;
  wonGrade: HTMLParagraphElement;
  lostGrade: HTMLParagraphElement;
  wonTip: HTMLParagraphElement;
  lostTip: HTMLParagraphElement;
  btnStart: HTMLButtonElement;
  btnResume: HTMLButtonElement;
  btnResumeSave: HTMLButtonElement;
  btnRestartPause: HTMLButtonElement;
  btnTitlePause: HTMLButtonElement;
  btnAgainWin: HTMLButtonElement;
  btnTitleWin: HTMLButtonElement;
  btnAgainLost: HTMLButtonElement;
  btnTitleLost: HTMLButtonElement;
  btnLocal: HTMLButtonElement;
  btnRelay: HTMLButtonElement;
  btnDisconnect: HTMLButtonElement;
  btnWarnOk: HTMLButtonElement;
  btnTutOk: HTMLButtonElement;
  btnShareWin: HTMLButtonElement;
  btnShareLost: HTMLButtonElement;
  btnShareMenu: HTMLButtonElement;
  btnFullscreen: HTMLButtonElement;
  btnExportSave: HTMLButtonElement;
  btnImportSave: HTMLButtonElement;
  live: HTMLDivElement;
  achList: HTMLUListElement;
  inputs: Record<string, HTMLInputElement | HTMLSelectElement>;
}

export function wireSettingsTabs(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".settings-tabs").forEach((list) => {
    const host = list.parentElement;
    if (!host) return;
    list.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.tab;
        if (!id) return;
        list.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((b) => b.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        host.querySelectorAll<HTMLElement>(".tab-panel").forEach((p) => {
          p.classList.toggle("hidden", p.dataset.tabPanel !== id);
        });
      });
    });
  });
}

export function buildUi(root: HTMLDivElement, canvas: HTMLCanvasElement): UiRefs {
  const wrap = document.createElement("div");
  wrap.className = "game-wrap";
  wrap.appendChild(canvas);

  const crosshair = document.createElement("div");
  crosshair.className = "crosshair";
  crosshair.setAttribute("aria-hidden", "true");

  const hud = document.createElement("div");
  hud.innerHTML = hudHtml();
  const hudEl = hud.firstElementChild as HTMLDivElement;

  const radar = document.createElement("canvas");
  radar.id = "radar";
  radar.className = "radar";
  radar.setAttribute("aria-label", "Local echo radar");

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = [
    loadingScreen(),
    contentWarningPanel(),
    tutorialPanel(),
    menuPanelHtml(),
    pausePanelHtml(),
    endPanelHtml("won", "Escaped", "You read the maze, kept your nerve, and found the gate."),
    endPanelHtml("lost", "Caught", "The hunters converged on your noise trail."),
  ].join("");

  const mobile = document.createElement("div");
  mobile.innerHTML = mobileControlsHtml();

  wrap.insertAdjacentHTML(
    "beforeend",
    vignetteLayer() +
      `<div id="ping-flash" class="ping-flash" aria-hidden="true"></div>` +
      toastHost() +
      threatCompassHtml() +
      abilityDockHtml(),
  );
  wrap.append(crosshair, hudEl, radar, mobile.firstElementChild!, overlay);
  root.appendChild(wrap);

  const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};
  wrap.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => {
    inputs[el.id] = el;
  });

  wireSettingsTabs(wrap);
  refreshAchievementList(qs(wrap, "#ach-list"));

  return {
    wrap,
    overlay,
    hud: hudEl,
    crosshair,
    radar,
    hudHints: qs(wrap, "#hud-hints"),
    hudTime: qs(wrap, "#hud-time"),
    hudSector: qs(wrap, "#hud-sector"),
    hudObjective: qs(wrap, "#hud-objective"),
    meterRes: qs(wrap, "#meter-res"),
    meterDebt: qs(wrap, "#meter-debt"),
    meterThreat: qs(wrap, "#meter-threat"),
    keyChip: qs(wrap, "#key-chip"),
    doorChip: qs(wrap, "#door-chip"),
    missionChip: qs(wrap, "#mission-chip"),
    mpChip: qs(wrap, "#mp-chip"),
    campaignProgress: qs(wrap, "#campaign-progress"),
    bestTimesLine: qs(wrap, "#best-times-line"),
    panelMenu: qs(wrap, "#panel-menu"),
    panelPause: qs(wrap, "#panel-pause"),
    panelWon: qs(wrap, "#panel-won"),
    panelLost: qs(wrap, "#panel-lost"),
    panelWarn: qs(wrap, "#panel-warn"),
    panelTutorial: qs(wrap, "#panel-tutorial"),
    bootLoading: qs(wrap, "#boot-loading"),
    juiceVignette: qs(wrap, "#juice-vignette"),
    pingFlash: qs(wrap, "#ping-flash"),
    toastHost: qs(wrap, "#toast-host"),
    mobileControls: qs(wrap, "#mobile-controls"),
    threatCompass: qs(wrap, "#threat-compass"),
    threatWedge: qs(wrap, "#threat-wedge"),
    abilityDock: qs(wrap, ".ability-dock"),
    abilityPing: qs(wrap, "#ability-ping"),
    abilityFocus: qs(wrap, "#ability-focus"),
    abilityBeacon: qs(wrap, "#ability-beacon"),
    abilityThrow: qs(wrap, "#ability-throw"),
    cdPing: qs(wrap, "#cd-ping"),
    cdFocus: qs(wrap, "#cd-focus"),
    wonStats: qs(wrap, "#won-stats"),
    lostStats: qs(wrap, "#lost-stats"),
    wonGrade: qs(wrap, "#won-grade"),
    lostGrade: qs(wrap, "#lost-grade"),
    wonTip: qs(wrap, "#won-tip"),
    lostTip: qs(wrap, "#lost-tip"),
    btnStart: qs(wrap, "#btn-start"),
    btnResume: qs(wrap, "#btn-resume"),
    btnResumeSave: qs(wrap, "#btn-resume-save"),
    btnRestartPause: qs(wrap, "#btn-restart-pause"),
    btnTitlePause: qs(wrap, "#btn-title-pause"),
    btnAgainWin: qs(wrap, "#btn-again-win"),
    btnTitleWin: qs(wrap, "#btn-title-win"),
    btnAgainLost: qs(wrap, "#btn-again-lost"),
    btnTitleLost: qs(wrap, "#btn-title-lost"),
    btnLocal: qs(wrap, "#btn-local"),
    btnRelay: qs(wrap, "#btn-relay"),
    btnDisconnect: qs(wrap, "#btn-disconnect"),
    btnWarnOk: qs(wrap, "#btn-warn-ok"),
    btnTutOk: qs(wrap, "#btn-tut-ok"),
    btnShareWin: qs(wrap, "#btn-share-win"),
    btnShareLost: qs(wrap, "#btn-share-lost"),
    btnShareMenu: qs(wrap, "#btn-share-menu"),
    btnFullscreen: qs(wrap, "#btn-fullscreen"),
    btnExportSave: qs(wrap, "#btn-export-save"),
    btnImportSave: qs(wrap, "#btn-import-save"),
    live: qs(wrap, "#live-region"),
    achList: qs(wrap, "#ach-list"),
    inputs,
  };
}

export function refreshAchievementList(list: HTMLUListElement): void {
  const unlocked = loadAchievements();
  list.querySelectorAll<HTMLLIElement>("[data-ach]").forEach((li) => {
    const id = li.dataset.ach!;
    const on = unlocked.has(id);
    li.classList.toggle("ach-on", on);
    li.classList.toggle("ach-off", !on);
    if (on && !li.textContent?.includes("✓")) li.textContent = `${li.textContent} ✓`;
  });
}

export function showToast(host: HTMLElement, message: string): void {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

export type { UiRefs as default };
