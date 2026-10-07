# Changelog

All notable changes to `@particle-academy/fancy-motion` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0.** Breaking changes land in MINOR releases — read the entry, not the
> version number. The `0.0.1-dev.*` line is over as of `0.1.0`.

> This file starts at `0.0.1-dev.5`. Earlier dev builds predate it; `git log` is
> the record for those.

## [Unreleased]

### Fixed

- **`CHANGELOG.md` is now in the published tarball.** `files` did not whitelist it, so npm never shipped it — and this package puts breaking changes in MINOR releases and tells you in the README to read the entry before taking one. The instruction existed for the author, who has the file, and not for the consumer, who is the only one being instructed. Nothing for you to do; the file simply arrives from this release on.
- Dropped `docs` from `files`: it was declared and never existed, so the package claimed to ship it and did not.

### Security

- `source-map-js` is pinned forward to `^1.2.2` via `overrides`. Versions up to
  1.2.1 allow an event-loop denial of service through indexed source-map section
  offsets, and it arrives here transitively through the build toolchain.
  **Nothing for a consumer to do, and no runtime change**: an npm package does
  not ship a lockfile, so this governs builds OF this repo, not anything
  installed FROM it. Recorded rather than left silent because the override it
  sits beside — `shell-quote` `^1.9.0`, added for an earlier advisory — was
  carried with no note of why, and had drifted back inside the vulnerable range
  before anyone looked.

## [0.2.0] — 2026-08-09

### Added

- **`Reveal`** on the `./react` subpath — reveal children once they scroll into
  view. Story #170, task 231.

  ```tsx
  import { Reveal } from "@particle-academy/fancy-motion/react";
  <Reveal>…</Reveal>
  ```

  The `kinetic` and `cursor` gallery styles each hand-rolled this with an
  IntersectionObserver. It belongs here rather than in react-fancy because this
  package's thesis is that the page is a video and scroll is the playhead — an
  in-view trigger is that idea at its smallest.

  Three behaviours are deliberate, each a way this is commonly written wrong:

  - **Children always render**; revealing only flips `data-in-view`. Revealing by
    *mounting* hides content from search engines and from anyone whose observer
    never fires.
  - **It fails open.** No `IntersectionObserver` — SSR, older browsers — means
    revealed, not hidden. The alternative's failure mode is a blank page.
  - **`prefers-reduced-motion` starts revealed and never observes.** Not "animates
    faster": someone who asked the OS for less motion should not need a scroll
    event to see content.

  Styling is left to `[data-in-view]`, so a design can transition opacity,
  transform, clip-path or nothing.

## [0.1.0] — 2026-08-07

**First real release.** The `0.0.1-dev.*` preview line ends here.

### Changed

- **The package leaves preview.** Its own changelog said breaking changes would
  land without ceremony *until `0.1.0`* — this is that version. Breaking changes
  now land in minor releases and get a changelog entry saying what to do.

- **BREAKING — Node 22 is now declared as the floor.** `engines.node` moves from
  `>=18` to `>=22`.

  **What you must do:** on Node 22 or newer, nothing. npm only *warns* on an
  `engines` mismatch while **pnpm fails the install**, so this surfaces
  differently depending on your package manager.

- React 19 only (`peerDependencies.react` is `^19.0.0`), matching the rest of
  the kit 0.5 floors.

### Fixed

- **`npm install @particle-academy/fancy-motion` was giving you the FIRST
  preview build.** The `latest` dist-tag pointed at `0.0.1-dev.0` while the
  newest code sat behind the `dev` tag, so a plain install silently resolved to
  the oldest thing published — six builds behind, with no warning.

  **What you must do:** upgrade. `0.1.0` becomes `latest`, so a plain install
  now gets current code. If you pinned `0.0.1-dev.5` deliberately, this is the
  same code with the floors applied.

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
