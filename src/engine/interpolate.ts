/**
 * The pure scroll → snapshot tween engine. Given a playhead `progress` (0..1)
 * it resolves the interpolated {@link Snapshot} by lerping between the two
 * bracketing keyframes (elements matched by node id). Framework-agnostic and
 * fully unit-tested — the runtime player just feeds it scroll progress.
 */
import type { Ease, Keyframe, NodeState, Snapshot, TimelineDoc } from "../timeline/types";

const EASES: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
};

/** The transform fields all default; size (w/h) deliberately does not. */
type Transformed = Required<Omit<NodeState, "w" | "h">>;
const DEFAULT: Transformed = { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 };

function resolve(s: NodeState | undefined): Transformed {
  const { w: _w, h: _h, ...rest } = s ?? {};
  return { ...DEFAULT, ...rest };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function lerpState(a: NodeState | undefined, b: NodeState | undefined, t: number): NodeState {
  const ra = resolve(a);
  const rb = resolve(b);
  const out: NodeState = {
    x: lerp(ra.x, rb.x, t),
    y: lerp(ra.y, rb.y, t),
    opacity: lerp(ra.opacity, rb.opacity, t),
    scale: lerp(ra.scale, rb.scale, t),
    rotate: lerp(ra.rotate, rb.rotate, t),
  };
  // Size has no default — only tween it when at least one side declares it, so
  // a plain move/scale keyframe never pins a width onto an auto-sized element.
  if (a?.w !== undefined || b?.w !== undefined) out.w = lerp(a?.w ?? b?.w ?? 0, b?.w ?? a?.w ?? 0, t);
  if (a?.h !== undefined || b?.h !== undefined) out.h = lerp(a?.h ?? b?.h ?? 0, b?.h ?? a?.h ?? 0, t);
  return out;
}

/**
 * Flatten top-level keyframes + each scene's internal keyframes (mapped into the
 * scene's pinned [at, at+length] range) into one list sorted by absolute
 * proportional position. The sampler then treats everything uniformly.
 */
export function flattenTimeline(doc: TimelineDoc): Keyframe[] {
  const out: Keyframe[] = [...doc.keyframes];
  for (const scene of doc.scenes ?? []) {
    for (const k of scene.keyframes) {
      out.push({ ...k, at: scene.at + k.at * scene.length });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Resolve the snapshot at playhead `progress` (0..1) for a whole timeline. Pure. */
export function sampleTimeline(doc: TimelineDoc, progress: number): Snapshot {
  return sampleKeyframes(flattenTimeline(doc), progress);
}

/** Resolve the snapshot at `progress` from a sorted keyframe list. Pure. */
export function sampleKeyframes(keyframes: Keyframe[], progress: number): Snapshot {
  if (keyframes.length === 0) return {};
  const p = Math.min(1, Math.max(0, progress));
  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;
  if (p <= first.at) return first.snapshot;
  if (p >= last.at) return last.snapshot;

  let a = first;
  let b = last;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const lo = keyframes[i]!;
    const hi = keyframes[i + 1]!;
    if (p >= lo.at && p < hi.at) {
      a = lo;
      b = hi;
      break;
    }
  }

  const span = b.at - a.at || 1;
  const localT = (p - a.at) / span;
  const easeFn = EASES[b.ease ?? "linear"] ?? EASES.linear;
  const eased = easeFn(localT);

  const out: Snapshot = {};
  for (const id of new Set([...Object.keys(a.snapshot), ...Object.keys(b.snapshot)])) {
    out[id] = lerpState(a.snapshot[id], b.snapshot[id], eased);
  }
  return out;
}

/** CSS transform string + opacity (+ explicit size when the state declares it). */
export function toCss(state: NodeState): { transform: string; opacity: number; width?: string; height?: string } {
  const r = resolve(state);
  return {
    transform: `translate3d(${r.x}px, ${r.y}px, 0) scale(${r.scale}) rotate(${r.rotate}deg)`,
    opacity: r.opacity,
    ...(state.w !== undefined ? { width: `${state.w}px` } : {}),
    ...(state.h !== undefined ? { height: `${state.h}px` } : {}),
  };
}
