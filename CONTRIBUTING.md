# Contributing

## Layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Prefer `@/` imports. Keep new files near ~500 lines.

## Commands

```bash
npm install
npm run dev
npm run check   # eslint + tsc + vitest + build
```

## Guardrails

- No required backend for single-player
- No external art/audio sample assets
- WebSocket relay is client-adapter only
- Pure logic (collision, generator, grades, solvability) should have tests when changed

## Style

ESLint + Prettier. Run `npm run lint` before opening a PR.
