# Changelog

All notable changes to `@particle-academy/fancy-motion` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0.** Breaking changes land in MINOR releases — read the entry, not the
> version number. The `0.0.1-dev.*` line is over as of `0.1.0`.

> This file starts at `0.0.1-dev.5`. Earlier dev builds predate it; `git log` is
> the record for those.

## [Unreleased]

### Added

- **`MotionStage` can play somewhere other than the window.** It only ever
  read window scroll over a `frames x 100vh` spacer, so a stage could not live
  in a fixed-height box, a modal, a split pane or an editor canvas: the
  showcase's own preview had to drop it for a hand-driven engine call. Three
  additive props:
  - `scrollContainer` (an element or a ref): play from that element's scroll.
    The spacer and the sticky pin are sized from its client box instead of the
    viewport, so one frame is one container-height.
  - `progress` (0..1): the host owns the playhead. Scroll is ignored and no
    spacer is rendered; the stage is a plain box (size it with `className`)
    showing the timeline at that position. Pair it with `TimelineDock`'s
    `progress` + `onScrub` and the dock's Play drives the stage.
  - `onProgress(p)`: called with the playhead whenever a frame is applied.
  Nothing to do: with none of them set, the stage behaves exactly as before.
- **`Reveal` takes `root` and `onReveal`.** `root` (an element or a ref) is
  the scroll container to observe against, so `rootMargin` measures from its
  edges rather than the window's. A ref is resolved after commit, so a ref on
  the parent box rendered in the same pass works. `onReveal()` fires once when
  the block reveals, and on mount under `prefers-reduced-motion` or without
  IntersectionObserver, where the block starts revealed. Neither prop reaches
  the DOM. Nothing to do unless you want them.

### Changed

- **Releases need a lab-run certificate.** `publish.yml` gains a read-only
  `lab-certificate` job that every publishing job needs: a tag is published only
  when the fancy-labs lab has certified that exact version and commit. Consumers
  do nothing; this changes how releases are cut, not what the package does.

### Fixed

- **`TimelineDock`'s keyframe markers show keyboard focus.** A focused marker
  drew nothing (measured in Chromium with real Tab presses at 375, 768 and
  1280 px): its inline style set `outline: "none"` whenever it was not the
  selected keyframe, and an inline declaration beats any stylesheet rule. The
  selected marker's white ring is now a `box-shadow`, the inline outline is
  gone, and the dock injects one `[data-fmo-keyframe]:focus-visible` rule that
  draws the kit focus ring: a 2px outline in `var(--fancy-focus)`
  (`var(--fancy-focus-dark)` under `.dark` / `[data-theme="dark"]`), offset to
  clear the selection ring. Nothing to do on upgrade, unless you styled the
  selected marker by its inline `outline`, which is now a `box-shadow`.
- **`TimelineDock` no longer nests its controls inside the slider** (axe
  `nested-interactive`, lab run 601, K33). The keyframe markers and scene remove
  buttons sat inside `role="slider"`, where assistive tech flattens them into
  the slider. The track is now an area holding a childless slider layer plus
  the controls as its siblings. `[data-fmo-track]` still names the slider (same
  role, value and keys); the pointer area is the new `[data-fmo-track-area]`.
  Nothing to do unless your own CSS styled `[data-fmo-track]` as the visible
  track; move that to `[data-fmo-track-area]`.
- **`TimelineDock` frame numbers are readable** (axe `color-contrast`, 3.32:1).
  They drew the foreground at opacity 0.4; they now use a new
  `--fmo-muted` token (default `#94a3b8`, 6.9:1 on the default track).
- **`CHANGELOG.md` is now in the published tarball.** `files` did not whitelist it, so npm never shipped it — and this package puts breaking changes in MINOR releases and tells you in the README to read the entry before taking one. The instruction existed for the author, who has the file, and not for the consumer, who is the only one being instructed. Nothing for you to do; the file simply arrives from this release on.
- Dropped `docs` from `files`: it was declared and never existed, so the package claimed to ship it and did not.

### Security

- Update Vitest to 4.1.12 and patch the transitive undici development dependency for security fixes; dev toolchain only, nothing to do.

- `source-map-js` is pinned forward to `^1.2.2` via `overrides`. Versions up to
  1.2.1 allow an event-loop denial of service through indexed source-map section
  offsets, and it arrives here transitively through the build toolchain.
  **Nothing for a consumer to do, and no runtime change**: an npm package does
  not ship a lockfile, so this governs builds OF this repo, not anything
  installed FROM it. Recorded rather than left silent because the override it
  sits beside — `shell-quote` `^1.9.0`, added for an earlier advisory — was
  carried with no note of why, and had drifted back inside the vulnerable range
  before anyone looked.
- **Dev toolchain only — no runtime change, nothing for consumers to do.** The
  lockfile now resolves `vite` 8.3.5 (was 8.3.0), whose bundled
  `launch-editor` fixes GHSA-587h-7wmj-h5pm (HIGH, `fs.existsSync()` check
  bypassable on Windows), GHSA-698v-4r3x-3vcv (`escapeCmdArgs()` omits `%`
  escaping on Windows) and GHSA-r825-w8mm-5pxw (editor CLI flag
  misinterpretation). `vite` is only reached through the test/dev toolchain
  and the published package does not ship our lockfile, so the exposure was
  this repo's own dev server.

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
