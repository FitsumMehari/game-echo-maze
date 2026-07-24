# Architecture

Echo Maze Overdrive uses a layered, feature-oriented TypeScript layout. Keep modules small, pure where possible, and UI pieces reusable.

```
src/
  main.ts                 # Thin entry — CSS + boot()
  app/                    # Composition root (wiring only)
    boot.ts               # Settings, overlays, loop, MP, saves
    hud.ts                # HUD update (reusable from loop)
    input.ts              # Keyboard, gamepad helpers, mobile, look
  core/                   # Shared primitives
    constants.ts
    types.ts
    format.ts
  game/                   # Simulation
    Game.ts               # Scene + session orchestration
    abilities.ts          # Ping / focus / beacon / throw
    hunterAi.ts           # Hunter FSM
    collision.ts
    pulseSystem.ts
    grades.ts
  world/                  # Level data & rendering mesh
    level.ts
    levelGenerator.ts
    worldGeometry.ts
    solvability.ts
    shaders/
  audio/                  # Web Audio
    AudioEngine.ts
    micNoise.ts
  ui/                     # DOM presentation
    index.ts              # buildUi()
    radar.ts
    components/           # Reusable field/panel/dom helpers
    panels/               # Menu/pause/end markup builders
  systems/                # Persistence & meta progression
    campaign, settings, difficulty, mutators,
    bestTimes, achievements, dailyChallenge, runSave, controls
  net/                    # BroadcastChannel + WS ghosts
  styles/                 # CSS
```

## Dependency direction

`app` → `game` / `ui` / `systems` / `audio` / `net`  
`game` → `world` / `core` / `audio` (types) / `systems` (mission config)  
`ui` → `systems` (labels) / `core`  
`world` → `core` only  

Do not import `app` from lower layers.

## Reusable UI

- [`ui/components/dom.ts`](src/ui/components/dom.ts) — `el`, `qs`, `html`
- [`ui/components/fields.ts`](src/ui/components/fields.ts) — select/range/check/text/fieldset/button
- [`ui/components/panels.ts`](src/ui/components/panels.ts) — warning/tutorial/loading shells
- [`ui/panels/shell.ts`](src/ui/panels/shell.ts) — composes campaign + settings fieldsets

Add new settings by extending a fieldset helper, not by duplicating HTML in `boot.ts`.

## Guardrails

- Prefer files under ~500 lines
- No required backend for single-player
- No external art/audio assets
- Path alias `@/` → `src/`
- Tests for pure logic (`solvability`, `grades`, generator determinism)
