import type { Game } from "@/game/Game";
import type { GameSettings } from "@/systems/settings";
import { MAX_MISSION_LEVEL } from "@/systems/campaign";
import { formatTimeShort } from "@/core/format";
import { drawRadar } from "@/ui/radar";
import type { UiRefs } from "@/ui";

function setCooldown(el: HTMLElement, cdEl: HTMLElement, ratio: number): void {
  const r = Math.max(0, Math.min(1, ratio));
  cdEl.style.setProperty("--cd", `${r * 100}%`);
  el.classList.toggle("ready", r < 0.02);
}

export function updateHud(game: Game, ui: UiRefs, settings: GameSettings): void {
  ui.hudTime.textContent = formatTimeShort(game.simulationTime);
  ui.missionChip.textContent = `Mission ${game.missionLevel}/${MAX_MISSION_LEVEL}`;
  const g = game.getPlayerGrid();
  ui.hudSector.textContent = `L${game.missionLevel} · ${g.ix},${g.iz}`;
  ui.hudObjective.textContent = game.getObjectiveText();
  ui.meterRes.style.width = `${game.resonance}%`;
  ui.meterDebt.style.width = `${Math.min(100, game.echoDebt * 100)}%`;
  ui.meterThreat.style.width = `${Math.min(100, game.threat * 100)}%`;
  ui.keyChip.textContent = game.hasEchoKey ? "Key: held" : "Key: missing";
  ui.keyChip.classList.toggle("good", game.hasEchoKey);
  ui.doorChip.classList.toggle("hidden", !game.doorOpen);

  setCooldown(ui.abilityPing, ui.cdPing, game.pingCooldown / 0.48);
  setCooldown(ui.abilityFocus, ui.cdFocus, game.focusCooldown / 1.6);
  ui.abilityBeacon.classList.toggle("ready", game.resonance >= 24 && game.beacons.length < 3);
  ui.abilityThrow.classList.toggle("ready", game.projectiles.length < 5);

  const threat = game.getNearestThreat();
  ui.threatCompass.classList.toggle("hot", threat != null && threat.dist < 14 && game.threat > 0.18);
  if (threat) {
    const rel = threat.bearing - game.yaw;
    ui.threatWedge.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
  }

  if (settings.showRadar && settings.mutator !== "no-radar") {
    drawRadar(ui.radar, game.getRadarSnapshot(settings.visualAssist ? 12 : 9), settings.theme, settings.visualAssist);
  }
}

export function flashPing(ui: UiRefs): void {
  ui.pingFlash.classList.add("on");
  window.setTimeout(() => ui.pingFlash.classList.remove("on"), 90);
}
