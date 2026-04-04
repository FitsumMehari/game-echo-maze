# Echo Maze

**Echo Maze** is a first-person browser maze rendered almost entirely in darkness. Walking, sonar pings, and thrown sparks emit expanding rings that briefly expose geometry—while two roaming hunters steer toward your noise.

Stack: **Vite**, **TypeScript**, **Three.js** (WebGL 2, custom GLSL 300 es shaders), **Web Audio API** (fully procedural sound, no sample assets).

---

## Play locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

---

## Production build

```bash
npm run build
```

Static output is written to `dist/`. Serve it with any static host or preview locally:

```bash
npm run preview
```

---

## Deploy (free tiers)

`dist/` is static HTML/CSS/JS—compatible with **GitHub Pages**, **Cloudflare Pages**, **Netlify**, **Vercel**, or any object-storage static website.

For GitHub Project Pages at `https://<user>.github.io/<repo>/`, set the Vite base path to your repository name:

```ts
// vite.config.ts
export default defineConfig({
  base: "/<repo>/",
  build: { chunkSizeWarningLimit: 900 },
});
```

Rebuild after changing `base`.

---

## Controls

| Input | Action |
|--------|--------|
| **WASD** / arrows | Move |
| **Shift** | Quieter footsteps (weaker echoes) |
| **Space** | Sonar ping |
| **F** | Throw a pulse stone forward |
| **R** | Restart the current run |
| **Esc** | Pause / resume |
| Mouse | Look (pointer lock when supported; drag otherwise) |
| Touch drag | Look on devices without pointer lock |

---

## Settings

Settings persist in **localStorage** (`echo-maze-settings-v1`): mouse sensitivity, master volume, and whether in-game control hints are shown. Sliders appear on the title screen and in the pause menu.

---

## Requirements

- A browser with **WebGL 2**. If the GPU or browser blocks WebGL, the game shows an explicit error instead of failing silently.
- **Audio**: click **Begin** (user gesture) so the AudioContext can start; allow audio if the browser prompts.

---

## Design notes

- **Simulation time** drives shaders and pulses only while the run is active—pausing or returning to the title freezes echo propagation visually.
- **Resonance (0–100)** builds while you stand still or move in stealth. At high charge, **Space** performs a **harmonic ping**—two stacked wave speeds for a twin-ring read of the maze (costs Resonance; longer cooldown than a normal ping).
- **Echo heat (0–100%)** rises with loud footsteps, throws, and manual pings, and cools in stealth. It **multiplies hunter speed**—aggression comes from your own noise budget, not a separate script.
- **Silence dividend**: if Echo heat stays at or below **~16%** for **~4.25s**, you get a **+22 Resonance** payout (with a soft audio cue). The streak resets whenever heat rises above the gate—rewarding disciplined quiet play.
- **Ringwell** floor tiles (`=` / `+` in the level map) **amplify** footstep echoes—shortcut for charging Resonance and mapping quickly, at the cost of noise.
- **Echo key**: levels can place `k` pickup tiles. The **exit stays sealed** until the key is collected (you hear a low **seal-denied** tone if you try too early).
- **Absorbing** and **decoy** walls differ in absorption; **decoy** echoes use a **time-warped lie vector** in the fragment shader—the false surface “breathes,” so you can learn to distrust it.
- **Hazards** send you back to the entrance with feedback rather than ending the session.

---

## Project layout

| Path | Role |
|------|------|
| `src/game.ts` | Scene, movement, AI, projectiles, win/lose |
| `src/shaders/worldShader.ts` | Echo ring reveal |
| `src/worldGeometry.ts` | Merged level mesh + echo spheres |
| `src/audioEngine.ts` | Procedural SFX + master gain |
| `src/settings.ts` | Persisted preferences |
| `src/main.ts` | UI shell, input, WebGL checks |

---

## License

Personal / portfolio use unless you add your own license file.
