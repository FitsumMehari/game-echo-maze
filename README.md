# Echo Maze Overdrive

First-person **sonar stealth** maze in the browser. Walking, pings, focus scans, stones, and beacons emit expanding rings that reveal geometry while hunters hunt your noise.

**Stack:** Vite · TypeScript · Three.js/WebGL2 · custom GLSL · Web Audio · localStorage · BroadcastChannel / optional WebSocket ghosts.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the modular folder layout and reusable UI components.

---

## Play

```bash
npm install
npm run dev
```

```bash
npm run check   # lint (tsc) + tests + production build
```

---

## Highlights

- **33 named campaign sectors** with best times, grades, and unlocks
- **Hunter AI FSM** (idle → hear → search → chase → return) + stalker / ambusher / sound-eater kinds
- **Spatial headphones audio**, threat ducking, ambient landmarks
- **Difficulty presets**, post-finale **mutators**, **daily seeded challenge**
- **Accessibility:** themes, visual assist, flash reduce, radar, volume mix, content warning + tutorial
- **Mobile virtual stick**, gamepad support, mid-run autosave / resume
- **Achievements**, share-run clipboard, PWA manifest, MIT license
- Ghost multiplayer remains **cosmetic peers only** (frontend-only)

---

## Controls

| Input | Action |
| --- | --- |
| WASD / stick | Move |
| Shift | Quiet steps |
| Space | Sonar ping (harmonic at high Resonance) |
| Q / E / F | Focus / Beacon / Throw |
| R | Restart | Esc | Pause |
| Gamepad | Left stick move, right stick look, A ping, etc. |

---

## Project layout (summary)

| Path | Role |
| --- | --- |
| `src/app/` | Boot, HUD, input wiring |
| `src/game/` | Simulation, hunters, abilities |
| `src/world/` | Maze gen, mesh, solvability, shaders |
| `src/ui/` | Reusable DOM components + panels |
| `src/systems/` | Campaign, settings, saves, daily, achievements |
| `src/audio/` | Procedural SFX + mic optional heat |
| `src/net/` | Ghost multiplayer adapters |

---

## License

MIT — see [LICENSE](LICENSE).
