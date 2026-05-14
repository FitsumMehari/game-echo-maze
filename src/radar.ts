import { Cell } from "./level";
import type { RadarSnapshot } from "./gameTypes";
import type { ThemeId } from "./settings";

const PALETTES: Record<ThemeId, { bg: string; wall: string; floor: string; hot: string; key: string; exit: string; peer: string }> = {
  abyss: { bg: "#061019", wall: "#6aa8ff", floor: "#183044", hot: "#ff5c70", key: "#ffd260", exit: "#5dffc8", peer: "#9fd7ff" },
  neon: { bg: "#070718", wall: "#fb44ff", floor: "#11264a", hot: "#ff3864", key: "#faff4b", exit: "#00ffd0", peer: "#7be7ff" },
  ember: { bg: "#170a05", wall: "#ff8f42", floor: "#362014", hot: "#ff2f12", key: "#ffd36e", exit: "#8cff7d", peer: "#ffd0aa" },
  contrast: { bg: "#000", wall: "#fff", floor: "#444", hot: "#ff0", key: "#0ff", exit: "#0f0", peer: "#fff" },
};

export function drawRadar(canvas: HTMLCanvasElement, snap: RadarSnapshot, theme: ThemeId, assist: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const css = Math.floor(canvas.getBoundingClientRect().width || 180);
  const size = Math.max(130, css);
  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const p = PALETTES[theme];
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, size, size);
  const cells = snap.radius * 2 + 1;
  const cell = size / cells;
  const ox = snap.player.ix - snap.radius;
  const oz = snap.player.iz - snap.radius;
  ctx.globalAlpha = assist ? 0.92 : 0.72;
  for (const rc of snap.cells) {
    const x = (rc.ix - ox) * cell;
    const y = (rc.iz - oz) * cell;
    if (rc.cell === Cell.Wall || rc.cell === Cell.WallAbsorb || rc.cell === Cell.WallDecoy || rc.cell === Cell.Door) ctx.fillStyle = p.wall;
    else if (rc.cell === Cell.Hazard) ctx.fillStyle = p.hot;
    else if (rc.cell === Cell.Exit) ctx.fillStyle = p.exit;
    else if (rc.cell === Cell.Key) ctx.fillStyle = p.key;
    else ctx.fillStyle = p.floor;
    ctx.fillRect(x + 0.5, y + 0.5, Math.max(1, cell - 1), Math.max(1, cell - 1));
  }
  ctx.globalAlpha = 1;
  drawMarker(ctx, snap.exit.ix - ox + 0.5, snap.exit.iz - oz + 0.5, cell, p.exit, "square");
  snap.keys.forEach((k) => drawMarker(ctx, k.ix - ox + 0.5, k.iz - oz + 0.5, cell, p.key, "diamond"));
  snap.enemies.forEach((e) => drawWorldMarker(ctx, e.x, e.z, ox, oz, cell, p.hot, "circle"));
  snap.beacons.forEach((b) => drawWorldMarker(ctx, b.x, b.z, ox, oz, cell, p.key, "ring"));
  snap.peers.forEach((peer) => drawWorldMarker(ctx, peer.x, peer.z, ox, oz, cell, p.peer, "triangle"));
  const px = (snap.player.x - ox) * cell;
  const py = (snap.player.z - oz) * cell;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-snap.player.yaw);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -cell * 0.48);
  ctx.lineTo(cell * 0.34, cell * 0.42);
  ctx.lineTo(-cell * 0.34, cell * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
}

function drawWorldMarker(ctx: CanvasRenderingContext2D, wx: number, wz: number, ox: number, oz: number, cell: number, color: string, kind: "circle" | "ring" | "triangle"): void {
  drawMarker(ctx, wx - ox, wz - oz, cell, color, kind);
}

function drawMarker(ctx: CanvasRenderingContext2D, gx: number, gz: number, cell: number, color: string, kind: "circle" | "ring" | "square" | "diamond" | "triangle"): void {
  const x = gx * cell;
  const y = gz * cell;
  const r = Math.max(3, cell * 0.35);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (kind === "circle") ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (kind === "ring") ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (kind === "square") ctx.rect(-r, -r, r * 2, r * 2);
  else if (kind === "diamond") { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); }
  else { ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); }
  if (kind === "ring") ctx.stroke(); else ctx.fill();
  ctx.restore();
}
