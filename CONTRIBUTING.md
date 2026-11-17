# Contributing to @particle-academy/fancy-motion

Notes for anyone, human or agent, working ON this package's code. How to USE the
package is in [AGENTS.md](./AGENTS.md); what it is, is in [README.md](./README.md).
`CLAUDE.md` is a symlink to this file, so Claude Code reads these notes when it
works in this repo.

## Build and test

```bash
npm run build       # tsup
npm run dev         # tsup --watch
npm run lint        # tsc --noEmit && eslint .
npm test            # vitest run
```

- Tests live in `tests/`.
- Two entries: `.` (the `TimelineDoc` model and the pure tween engine in
  `src/timeline/` and `src/engine/`, no React) and `./react` (`MotionStage`,
  `TimelineDock`, `Reveal` in `src/react/`). Keep React out of the root entry.

## Changelog

Update `CHANGELOG.md` (`## [Unreleased]`) in the same commit as the change.
