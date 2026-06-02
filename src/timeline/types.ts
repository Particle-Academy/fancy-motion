/**
 * TimelineDoc — the scroll-timeline model owned by fancy-motion. The page is a
 * video and scroll is the playhead. Authoring is **whole-page snapshots**: each
 * keyframe captures animatable per-node state; the engine tweens the diff
 * between consecutive snapshots as the playhead scrubs.
 */

export type Axis = "vertical" | "horizontal";

/** Animatable per-node state captured in a snapshot. Extensible. */
export interface NodeState {
  /** translate px along/across the layout (transform) */
  x?: number;
  y?: number;
  opacity?: number; // 0..1
  scale?: number;
  rotate?: number; // deg
  /**
   * Explicit size in px. Unlike the transform fields these are **optional with
   * no default** — absent means "leave the element auto-sized". They tween only
   * when present in the bracketing keyframes, so a pure move/scale never forces
   * a width onto an element that didn't ask for one.
   */
  w?: number;
  h?: number;
}

/** A whole-page snapshot: animatable state keyed by node id (e.g. the `data-cms` value). */
export type Snapshot = Record<string, NodeState>;

export type KeyframeMode = "snap" | "scroll";
export type Ease = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface Keyframe {
  id: string;
  /** Proportional position on the timeline, 0..1 — responsive-safe. */
  at: number;
  /** `snap` → snap the scroll here + auto-tween; `scroll` → scrub toward it. */
  mode: KeyframeMode;
  snapshot: Snapshot;
  /** Easing into this keyframe from the previous one (default linear). */
  ease?: Ease;
}

/** A pinned sub-sequence: the page holds while internal keyframes play, then releases. */
export interface Scene {
  id: string;
  /** Where the scene pins on the parent timeline, 0..1. */
  at: number;
  /** Proportional scroll length consumed while pinned, in 0..1 of the parent timeline. */
  length: number;
  /** Internal keyframes, each positioned 0..1 within the scene. */
  keyframes: Keyframe[];
}

export interface TimelineDoc {
  id: string;
  axis: Axis;
  /** Ruler length in viewport-sized frames (total scroll = frames × viewport). */
  frames: number;
  /** Top-level keyframes (engine sorts by `at`). */
  keyframes: Keyframe[];
  scenes?: Scene[];
}

export function emptyTimeline(id: string, axis: Axis = "vertical"): TimelineDoc {
  return { id, axis, frames: 1, keyframes: [], scenes: [] };
}
