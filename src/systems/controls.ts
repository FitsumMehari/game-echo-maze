export type ActionId =
  "forward" | "back" | "left" | "right" | "stealth" | "ping" | "focus" | "beacon" | "throw" | "restart" | "pause";

export type KeyMap = Record<ActionId, string>;

export const DEFAULT_KEYMAP: KeyMap = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  stealth: "ShiftLeft",
  ping: "Space",
  focus: "KeyQ",
  beacon: "KeyE",
  throw: "KeyF",
  restart: "KeyR",
  pause: "Escape",
};

export function mergeKeymap(partial: Partial<KeyMap> | undefined): KeyMap {
  return { ...DEFAULT_KEYMAP, ...(partial ?? {}) };
}

export interface MoveAxes {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  stealth: boolean;
}

export function pollGamepad(pad: Gamepad | null): MoveAxes & {
  lookX: number;
  lookY: number;
  ping: boolean;
  focus: boolean;
  beacon: boolean;
  throwStone: boolean;
  pause: boolean;
} {
  const empty = {
    forward: false,
    back: false,
    left: false,
    right: false,
    stealth: false,
    lookX: 0,
    lookY: 0,
    ping: false,
    focus: false,
    beacon: false,
    throwStone: false,
    pause: false,
  };
  if (!pad) return empty;
  const ax = (i: number) => pad.axes[i] ?? 0;
  const btn = (i: number) => pad.buttons[i]?.pressed ?? false;
  const dead = 0.28;
  const lx = Math.abs(ax(0)) > dead ? ax(0) : 0;
  const ly = Math.abs(ax(1)) > dead ? ax(1) : 0;
  const rx = Math.abs(ax(2)) > dead ? ax(2) : 0;
  const ry = Math.abs(ax(3)) > dead ? ax(3) : 0;
  return {
    forward: ly < -dead || btn(12),
    back: ly > dead || btn(13),
    left: lx < -dead || btn(14),
    right: lx > dead || btn(15),
    stealth: btn(6) || btn(10),
    lookX: rx,
    lookY: ry,
    ping: btn(0),
    focus: btn(2),
    beacon: btn(3),
    throwStone: btn(1),
    pause: btn(9),
  };
}
