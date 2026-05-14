# Upgrade notes

## Research translated into this build

I treated the game as a sonar-stealth browser game and borrowed product patterns from ten browser/arcade games and game categories:

1. BrowserQuest — HTML5 multiplayer, local progress, responsive play.
2. Pac-Man HTML5 ports — simple readable loops, procedural/asset-light audio, local browser play.
3. HexGL — WebGL mood, shader-forward visual identity, performance-first rendering.
4. Agar.io — low-friction room/nickname multiplayer idea and readable peer silhouettes.
5. Slither.io — simple controls, quick onboarding, instantly understandable competitive presence.
6. Krunker — FPS controls, spectating/peer presence, compact HUD chips.
7. Gartic Phone — lightweight room code UX.
8. Vampire Survivors-style visibility discussion — give players visibility/assist options when effects can overwhelm gameplay.
9. Classic stealth games — sound-as-risk economy, decoys, high-tension feedback.
10. Audio-first games — communicate state through layered sound, not visuals alone.

## Feature decisions

- **Focus Scan** adds a readable, non-noisy choice so visibility improvements do not delete the stealth tension.
- **Echo Beacon** makes noise management interactive: it is both a mapping tool and a hunter lure.
- **Radar** is intentionally local-range only; it improves UX without solving the whole maze.
- **Visual Assist** brightens the baseline and expands radar range, making the game more accessible without changing the core rules.
- **Campaign difficulty 1–33** is deterministic and progressive so single-player has a clear mission ladder instead of isolated random runs.
- **Multiplayer** is implemented as ghost-state networking because the game must remain static frontend. Browser-to-browser local tabs work with BroadcastChannel. True cross-device WebSocket rooms require a relay URL, but the client code is ready.
- **Audio mix** separates master, SFX, and ambience so the player can tune comfort.
- **Themes** affect CSS and GLSL palette together, so the UI and world feel coherent.

## Campaign update

- Added `src/campaign.ts` with mission configs, progress storage, mission option rendering, and next-mission unlocks.
- `src/levelGenerator.ts` now accepts maze sizing and density options so difficulty can scale without duplicating level files.
- `src/main.ts` wires Single player vs Multiplayer ghosts mode, locked mission selection, mission HUD chips, per-mission best times, and the win-to-next flow.

## Validation

- `npm install` from a clean copy succeeded.
- `npm run build` from a clean copy succeeded.
- All `src/**/*.ts` and `src/**/*.css` files are under 500 lines.

## May 14, 2026 start-flow hotfix

- Begin Mission now starts gameplay before attempting Web Audio unlock or pointer lock.
- Audio unlock and pointer lock are optional, guarded fallbacks so restricted browsers cannot block single-player mode.
- Settings no longer create an AudioContext before the first user gesture.
