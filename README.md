# @particle-academy/fancy-motion

[![Fancified](art/fancified.svg)](https://particle.academy)

The scroll-driven **timeline** motion engine for the Fancy UI suite. **The page
is a video; scroll is the playhead.**

> **Status: spine.** Ships the `TimelineDoc` model + the pure scroll→snapshot
> tween engine + a `MotionStage` runtime player (vertical scrub). The EditMode
> **timeline dock** (authoring), per-keyframe **snap** scrolling, **scene**
> pinning, and the **horizontal** player are the next slices.

## Model

Authoring is **whole-page snapshots** (Keynote-Magic-Move-for-scroll): arrange
the page → drop a **keyframe** → rearrange → drop another. The engine tweens the
diff between consecutive snapshots (elements matched by node id) as the playhead
scrubs. **Snap | Scroll is per-keyframe**; **Scenes** pin the page and play an
internal sub-sequence before releasing; **both scroll axes** are supported.
Keyframes anchor **proportionally** (0..1) so they survive responsive resizing.

```ts
import { sampleTimeline, type TimelineDoc } from "@particle-academy/fancy-motion";
import { MotionStage } from "@particle-academy/fancy-motion/react";

// pure: resolve the snapshot at any playhead position
const snapshot = sampleTimeline(timeline, 0.5);

// runtime: scroll drives the morph, applied to [data-cms] elements
<MotionStage timeline={timeline}>{page}</MotionStage>;
```

`fancy-cms` references a `TimelineDoc` by `timelineRef`; this package owns the
model, engine, dock, and player, and is reusable standalone.

MIT © Particle Academy
