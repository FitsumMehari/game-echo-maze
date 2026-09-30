# Echo Maze Overdrive

**A first-person sonar-stealth game where every useful sound also gives the hunters information.**

Echo Maze Overdrive runs entirely in the browser. The maze begins largely unreadable; movement, sonar pings, focus scans, thrown stones, and beacons emit expanding visual/audio signals that reveal the environment while also creating risk.

The project is a technical playground for real-time rendering, procedural generation, finite-state AI, spatial audio, input systems, accessibility, persistence, and browser delivery.

## Engineering highlights

- **TypeScript + Three.js/WebGL2** rendering pipeline.
- **Custom GLSL shaders** for the sonar-driven visual language.
- **Procedural maze generation** with solvability constraints.
- **Hunter finite-state machines** (`idle -> hear -> search -> chase -> return`) with multiple enemy archetypes.
- **Procedural/spatial Web Audio** with threat-aware mixing.
- **33 campaign sectors**, grades, unlocks, achievements, mutators, and daily seeded challenge logic.
- **Desktop, mobile, and gamepad input** including a mobile virtual stick.
- **Autosave/resume** and persistent local progression.
- **Accessibility options** including themes, visual assist, reduced flash, radar, volume controls, content warning, and tutorial support.
- **PWA delivery** for installable/offline-friendly browser play.
- **Vitest + Playwright** quality checks and automated production builds.

## Stack

`TypeScript` · `Vite` · `Three.js` · `WebGL2` · `GLSL` · `Web Audio` · `Vitest` · `Playwright` · `PWA`

## Run locally

Requires Node.js 22+.

```bash
npm install
npm run dev
```

## Quality check

```bash
npm run check
```

The check pipeline runs formatting verification, lint/type checking, unit tests, and a production build.

Additional commands:

```bash
npm run test
npm run test:e2e
npm run typecheck
npm run build
```

## Controls

| Input | Action |
| --- | --- |
| `WASD` / left stick | Move |
| `Shift` | Quiet steps |
| `Space` | Sonar ping |
| `Q` | Focus |
| `E` | Beacon |
| `F` | Throw |
| `R` | Restart |
| `Esc` | Pause |

Gamepad controls are also supported.

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/app/` | Boot, HUD, and input wiring |
| `src/game/` | Simulation, hunters, abilities |
| `src/world/` | Maze generation, meshes, solvability, shaders |
| `src/ui/` | Reusable DOM/UI components and panels |
| `src/systems/` | Campaign, settings, saves, daily challenge, achievements |
| `src/audio/` | Procedural SFX and spatial/threat audio |
| `src/net/` | Optional cosmetic ghost-multiplayer adapters |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper architecture walkthrough.

## Design note

The core tension is intentional: information is created through sound, and sound is also what makes the player detectable. Systems are designed around that tradeoff rather than treating sonar as a free visibility mechanic.

## License

MIT - see [`LICENSE`](LICENSE).
