import { formatTimeShort } from "@/core/format";

const keyFor = (level: number) => `echo-maze-best-sec-l${level}`;

export function loadBestTime(level: number): number | null {
  try {
    const raw = localStorage.getItem(keyFor(level));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveBestTime(level: number, timeSec: number): number | null {
  if (!Number.isFinite(timeSec) || timeSec <= 0) return loadBestTime(level);
  const prev = loadBestTime(level);
  if (prev === null || timeSec < prev) {
    try {
      localStorage.setItem(keyFor(level), String(timeSec));
    } catch {
      /* ignore */
    }
    return timeSec;
  }
  return prev;
}

export function formatBestLabel(level: number): string {
  const best = loadBestTime(level);
  return best === null ? "—" : formatTimeShort(best);
}

export function bestDeltaText(timeSec: number, level: number): string {
  const prev = loadBestTime(level);
  if (prev === null) return "New personal best";
  const d = timeSec - prev;
  if (d < -0.05) return `PB ${formatTimeShort(timeSec)} (−${formatTimeShort(-d)})`;
  if (Math.abs(d) <= 0.05) return `Tied PB ${formatTimeShort(timeSec)}`;
  return `+${formatTimeShort(d)} vs PB ${formatTimeShort(prev)}`;
}
