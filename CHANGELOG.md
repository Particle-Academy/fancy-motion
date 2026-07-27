# Changelog

All notable changes to `@particle-academy/fancy-motion` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-release.** This package is `0.0.1-dev.*` and its API is not settled.
> Breaking changes land without ceremony until `0.1.0`.

> This file starts at `0.0.1-dev.5`. Earlier dev builds predate it; `git log` is
> the record for those.

## [Unreleased]

## [0.0.1-dev.5] — 2026-07-27

### Fixed

- **Keyframe markers had no content at all.** Each rendered as
  `<button style={diamond} />` — an element with no text, no label and no icon —
  so every keyframe on the timeline announced itself as "button" and there was
  nothing for an agent to target but a pixel position. They now carry
  `aria-label` (mode and position), `aria-pressed` for the selected one, and a
  `data-fmo-keyframe` handle keyed by id.

  Selection was previously communicated by a white CSS outline **and nothing
  else**, so it existed only for people who could see it.

- **The scrub track was a bare `<div>` with pointer handlers** — no role, no
  value, and unreachable by keyboard. It is now `role="slider"` with
  `aria-valuenow`/`aria-valuetext`, and arrow keys scrub it (Shift for a coarse
  step, Home/End to jump). It is only a tab stop when `onScrub` is supplied,
  since a focusable control that does nothing is worse than none.

- **The scene-remove button was named `✕`** — a glyph, not a name.

### Changed

- **The dock themes through a `--fmo-*` layer.** Every colour was a hardcoded
  slate hex, so a host could not retheme the timeline at all. The tokens carry
  the previous values as fallbacks, so **the default rendering is unchanged**
  and only a host that themes sees a difference:

  ```css
  .my-app { --fmo-surface: #17171c; --fmo-accent: #ec4899; }
  ```

  It still defaults to dark — it is editor chrome sitting over a live page, the
  same call a video editor's timeline makes — but that is now a default rather
  than a hard-coding. Matches how `fancy-flow` (`--ff-*`) and `fancy-cms-ui`
  (`--fcms-*`) solve the same problem.

  **These are deliberately not react-fancy components.** The dock is an
  unconditionally dark surface, and react-fancy's dark styling depends on a
  `.dark` ancestor supplied by the *host's* Tailwind build — so its buttons
  would render light-on-dark in any light-themed app. The controls are also
  11px chips in a dense timeline, below react-fancy's smallest size. The token
  layer is the fix that fits.

### Added

- **jsdom, a vitest config and the package's first component tests.** The only
  suite tested `interpolate`, and there was no way to render either React
  component — which is precisely how a button with no content shipped. Seven
  tests; all seven fail against the previous code.
- **This changelog.** The package had none.
