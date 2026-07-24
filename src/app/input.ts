import type { Game } from "@/game/Game";
import type { UiRefs } from "@/ui";
import type { KeyMap } from "@/systems/controls";

export interface MobileMove {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  stealth: boolean;
}

export function createMobileMove(): MobileMove {
  return { forward: false, back: false, left: false, right: false, stealth: false };
}

export function wireKeyboard(game: Game, keys: Set<string>, onPause: () => void, getKeymap?: () => KeyMap): void {
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.code === "Escape") {
      onPause();
      return;
    }
    if (e.repeat || game.phase !== "playing") return;
    const km = getKeymap?.();
    if (e.code === (km?.ping ?? "Space")) game.tryPing();
    if (e.code === (km?.focus ?? "KeyQ")) game.tryFocus();
    if (e.code === (km?.beacon ?? "KeyE")) game.tryBeacon();
    if (e.code === (km?.restart ?? "KeyR")) game.resetLevel();
    if (e.code === (km?.throw ?? "KeyF")) {
      const dir = game.getForwardDirection();
      game.tryThrow(dir.x, dir.z);
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
}

export function wireMobile(ui: UiRefs, game: Game, move: MobileMove): void {
  const zone = ui.mobileControls.querySelector("#stick-zone") as HTMLDivElement;
  const knob = ui.mobileControls.querySelector("#stick-knob") as HTMLDivElement;
  let active = false;
  const setMove = (x: number, y: number) => {
    move.forward = y < -0.35;
    move.back = y > 0.35;
    move.left = x < -0.35;
    move.right = x > 0.35;
    knob.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
  };
  const onStick = (clientX: number, clientY: number) => {
    const r = zone.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / (r.width / 2)));
    const y = Math.max(-1, Math.min(1, (clientY - (r.top + r.height / 2)) / (r.height / 2)));
    setMove(x, y);
  };
  zone.addEventListener(
    "pointerdown",
    (e) => {
      active = true;
      zone.setPointerCapture(e.pointerId);
      onStick(e.clientX, e.clientY);
    },
    { passive: true },
  );
  zone.addEventListener(
    "pointermove",
    (e) => {
      if (active) onStick(e.clientX, e.clientY);
    },
    { passive: true },
  );
  zone.addEventListener("pointerup", () => {
    active = false;
    setMove(0, 0);
  });
  ui.mobileControls.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
    const act = btn.dataset.act;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (act === "stealth") move.stealth = true;
      if (act === "ping") game.tryPing();
      if (act === "focus") game.tryFocus();
      if (act === "beacon") game.tryBeacon();
      if (act === "throw") {
        const d = game.getForwardDirection();
        game.tryThrow(d.x, d.z);
      }
    });
    btn.addEventListener("pointerup", () => {
      if (act === "stealth") move.stealth = false;
    });
  });
}

export function wireLookControls(
  game: Game,
  canvas: HTMLCanvasElement,
  state: {
    pointerLocked: boolean;
    dragLook: boolean;
    lastMouse: { x: number; y: number };
    lastTouch: { x: number; y: number } | null;
  },
  requestLock: () => void,
): void {
  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (game.phase !== "playing") return;
    if (e.button === 0) {
      state.dragLook = true;
      state.lastMouse = { x: e.clientX, y: e.clientY };
      requestLock();
    }
  });
  window.addEventListener("mouseup", () => {
    state.dragLook = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (game.phase !== "playing") return;
    if (state.pointerLocked) game.addMouseLook(e.movementX, e.movementY);
    else if (state.dragLook) {
      game.addMouseLook(e.clientX - state.lastMouse.x, e.clientY - state.lastMouse.y);
      state.lastMouse = { x: e.clientX, y: e.clientY };
    }
  });
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (game.phase === "playing" && e.touches.length === 1) {
        const t = e.touches[0]!;
        state.lastTouch = { x: t.clientX, y: t.clientY };
      }
    },
    { passive: true },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (game.phase !== "playing" || !state.lastTouch || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      game.addMouseLook((t.clientX - state.lastTouch.x) * 1.35, (t.clientY - state.lastTouch.y) * 1.35);
      state.lastTouch = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener("touchend", () => {
    state.lastTouch = null;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}
