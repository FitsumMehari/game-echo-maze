# Echo Maze Overdrive

**Echo Maze Overdrive** is a first-person browser maze rendered mostly in darkness. Walking, sonar pings, focus scans, thrown stones, and echo beacons emit expanding rings that reveal geometry while hunters steer toward the noise you create.

Stack: **Vite**, **TypeScript**, **Three.js/WebGL2**, **custom GLSL**, **Web Audio API**, **localStorage**, **BroadcastChannel**, and an optional **WebSocket client adapter**. It is still a static frontend app: no bundled backend, no sample assets, no server requirement for single-player.

---

## What changed in this upgraded version

- Refactored the app so every source file is under 500 lines.
- Rebuilt the shell UI with a clearer title screen, pause panel, objective chip, action chips, high-contrast focus states, and better mobile layout.
- Added a **single-player mission campaign** with 33 deterministic difficulty levels, local progress unlocks, and next-mission flow after completion.
- Added four visual themes: Abyss, Neon, Ember, and High Contrast.
- Added Visual Assist, radar toggle, separate master/SFX/ambience volume controls, and persistent settings.
- Added adaptive procedural ambience that rises with Echo heat and Resonance.
- Added **Q Focus Scan**: spends Resonance for a silent local reveal.
- Added **E Echo Beacon**: spends Resonance to drop a pulsing decoy that can lure hunters.
- Added a local tactical radar with walls, hazards, key, exit, hunters, beacons, and peer ghosts.
- Added multiplayer/spectator “ghosts”:
  - **Local tabs** uses `BroadcastChannel` and works immediately across multiple tabs on the same origin.
  - **WebSocket relay** connects to a user-provided `ws://` or `wss://` relay URL. Because the project must remain frontend-only, the relay server is not bundled.
- Added run stat tracking for focus scans and beacons.
- Improved shader palette and baseline readability while preserving the sonar-dark identity.

---

## Play locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal, usually `http://localhost:5173`.

---

## Production build

```bash
npm run build
```

Static output is written to `dist/`. Serve it with any static host or preview locally:

```bash
npm run preview
```

`dist/` is compatible with GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static host.

---

## Controls

| Input | Action |
| --- | --- |
| **WASD** / arrows | Move |
| **Shift** | Quieter footsteps |
| **Space** | Sonar ping; at high Resonance, harmonic twin-ring ping |
| **Q** | Focus Scan: silent short-range reveal, costs Resonance |
| **E** | Echo Beacon: drops pulsing decoy, costs Resonance |
| **F** | Throw pulse stone forward |
| **R** | Restart current run |
| **Esc** | Pause / resume |
| Mouse | Look, pointer lock when supported |
| Touch drag | Look on touch devices |

---

## Single-player campaign

The default mode is **Single player**. Choose the highest unlocked mission from the title screen and complete it by collecting the echo key and reaching the exit. Winning a mission unlocks the next one locally, from level **1** through **33**. Difficulty scales by:

- maze dimensions, from compact training grids to full overdrive labyrinths;
- hunter count and placement pressure;
- hazard count, resonant tiles, and deceptive/absorbing walls;
- deterministic seeds so every mission can be learned, replayed, and improved.

Switch to **Multiplayer ghosts** only when you want optional local-tab or WebSocket peer silhouettes. Core progression remains single-player and frontend-only.

---

## Multiplayer notes

This project remains frontend-only. A browser can open a WebSocket connection, but it cannot host a public WebSocket relay for other browsers by itself.

- Use **Local tabs** to test ghost multiplayer with two tabs on the same origin.
- Use **Connect relay** when you have a relay URL that broadcasts JSON messages among clients in the same room.
- The game sends lightweight peer state only: id, name, position, yaw, phase, heat, resonance, and timestamp.
- Remote players are visualized as echo ghosts; the server is not authoritative and no gameplay state is trusted from peers.

---

## Settings persistence

Settings persist in `localStorage` under `echo-maze-settings-v2`: selected mission, play mode, theme, visual assist, radar, HUD hints, mouse sensitivity, audio mix, player name, room code, and relay URL. Campaign unlock progress persists under `echo-maze-campaign-v1`.

---

## Requirements

- Browser with **WebGL 2** and hardware acceleration.
- Audio starts after the first user gesture, as required by browser autoplay policies.
- Optional multiplayer relay must use `ws://` or `wss://`.

---

## Project layout

| Path | Role |
| --- | --- |
| `src/main.ts` | App boot, settings wiring, input, render loop |
| `src/ui.ts` | DOM shell for panels/HUD/settings |
| `src/game.ts` | Scene, movement, AI, abilities, win/lose, peer ghosts |
| `src/gameTypes.ts` | Shared game/radar/network types |
| `src/multiplayer.ts` | BroadcastChannel + WebSocket client adapter |
| `src/radar.ts` | Canvas tactical radar |
| `src/shaders/worldShader.ts` | Echo reveal shader and theme palettes |
| `src/worldGeometry.ts` | Merged level mesh + echo spheres |
| `src/audioEngine.ts` | Procedural SFX + adaptive ambience |
| `src/settings.ts` | Persistent settings and theme metadata |
| `src/campaign.ts` | 33-mission difficulty curve and progress persistence |
| `src/levelGenerator.ts` | Procedural maze generation |

---

## Implementation guardrails

- All source files are under 500 lines.
- No backend code is required for the shipped single-player campaign or local-tab experience.
- No external art or audio assets are required.
- WebSocket support is an adapter, not a hidden dependency.

---

## License

Personal / portfolio use unless you add your own license file.
