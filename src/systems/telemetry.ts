/** Local-only funnel counters — never networked. */
const KEY = "echo-maze-telemetry-v1";

export type TelemetryEvent = "start" | "die" | "win" | "tutorial_done";

export interface TelemetryCounters {
  start: number;
  die: number;
  win: number;
  tutorial_done: number;
}

const EMPTY: TelemetryCounters = { start: 0, die: 0, win: 0, tutorial_done: 0 };

export function loadTelemetry(): TelemetryCounters {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const j = JSON.parse(raw) as Partial<TelemetryCounters>;
    return {
      start: Number(j.start) || 0,
      die: Number(j.die) || 0,
      win: Number(j.win) || 0,
      tutorial_done: Number(j.tutorial_done) || 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function track(event: TelemetryEvent): TelemetryCounters {
  const cur = loadTelemetry();
  cur[event] += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* ignore */
  }
  return cur;
}
