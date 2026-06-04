import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import type { Keyframe, TimelineDoc } from "../timeline/types";

export interface TimelineDockProps {
  value: TimelineDoc;
  onChange: (doc: TimelineDoc) => void;
  /** Playhead position 0..1. */
  progress?: number;
  onScrub?: (progress: number) => void;
  selectedKeyframe?: string | null;
  onSelectKeyframe?: (id: string | null) => void;
  /** Milliseconds the Play button takes to sweep the whole timeline (default frames × 1400ms). */
  previewDurationMs?: number;
}

/**
 * The EditMode timeline dock. A single page is a video; this is its filmstrip:
 * a **frame ruler** (1 segment ≈ 1 viewport), **keyframe** markers you can add /
 * select / toggle snap·scroll, and a scrubbable **playhead**. Keyframes capture
 * whole-page snapshots (the engine tweens between them). Controlled.
 */
export function TimelineDock({
  value,
  onChange,
  progress = 0,
  onScrub,
  selectedKeyframe = null,
  onSelectKeyframe,
  previewDurationMs,
}: TimelineDockProps): ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const frames = Math.max(1, value.frames);
  const sorted = [...value.keyframes].sort((a, b) => a.at - b.at);
  const selected = sorted.find((k) => k.id === selectedKeyframe) ?? null;

  // Play = sweep the playhead 0→1 over time so you can preview the configured
  // animation without scrolling. Driven by setInterval (fires in background tabs
  // too, unlike rAF) off wall-clock elapsed, so playback speed is frame-independent.
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  };
  useEffect(() => () => stop(), []);
  const play = () => {
    if (!onScrub) return;
    if (timer.current) clearInterval(timer.current);
    const duration = Math.max(600, previewDurationMs ?? frames * 1400);
    const from = progress >= 0.999 ? 0 : progress; // restart if parked at the end
    const t0 = Date.now() - from * duration;
    setPlaying(true);
    onScrub(from);
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      onScrub(p);
      if (p >= 1) stop();
    }, 1000 / 30); // 30fps — smooth enough, and easy on heavy full-page subtrees
  };
  const togglePlay = () => (playing ? stop() : play());

  const addKeyframe = () => {
    const id = `kf-${value.keyframes.length + 1}-${Math.floor(performance.now())}`;
    const kf: Keyframe = { id, at: clamp01(progress), mode: "scroll", snapshot: {} };
    onChange({ ...value, keyframes: [...value.keyframes, kf] });
    onSelectKeyframe?.(id);
  };
  const addScene = () => {
    const id = `sc-${(value.scenes?.length ?? 0) + 1}`;
    onChange({
      ...value,
      scenes: [...(value.scenes ?? []), { id, at: clamp01(progress), length: 0.15, keyframes: [] }],
    });
  };
  const patchKf = (id: string, patch: Partial<Keyframe>) =>
    onChange({ ...value, keyframes: value.keyframes.map((k) => (k.id === id ? { ...k, ...patch } : k)) });
  const removeKf = (id: string) => {
    onChange({ ...value, keyframes: value.keyframes.filter((k) => k.id !== id) });
    if (selectedKeyframe === id) onSelectKeyframe?.(null);
  };
  const patchScene = (id: string, patch: Partial<{ at: number; length: number }>) =>
    onChange({ ...value, scenes: (value.scenes ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeScene = (id: string) =>
    onChange({ ...value, scenes: (value.scenes ?? []).filter((s) => s.id !== id) });

  // Scene resize — drag the left edge to move the start, the right edge to set
  // the length. Min length 0.02 (so a scene never collapses to zero).
  const sceneDrag = useRef<{ id: string; edge: "l" | "r" } | null>(null);
  const posOnTrack = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp01((clientX - r.left) / r.width);
  };
  const onSceneHandleDown = (id: string, edge: "l" | "r") => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    sceneDrag.current = { id, edge };
  };
  const onSceneHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = sceneDrag.current;
    if (!d) return;
    const s = (value.scenes ?? []).find((x) => x.id === d.id);
    if (!s) return;
    const p = posOnTrack(e.clientX);
    if (d.edge === "l") {
      const at = Math.max(0, Math.min(p, s.at + s.length - 0.02));
      patchScene(d.id, { at, length: s.at + s.length - at });
    } else {
      patchScene(d.id, { length: Math.max(0.02, Math.min(1 - s.at, p - s.at)) });
    }
  };
  const onSceneHandleUp = () => {
    sceneDrag.current = null;
  };

  const scrubTo = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !onScrub) return;
    const r = el.getBoundingClientRect();
    onScrub(clamp01((clientX - r.left) / r.width));
  };
  const onTrackPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubTo(e.clientX);
  };
  const onTrackMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons & 1) scrubTo(e.clientX);
  };

  return (
    <div style={dock} data-fancy-motion-dock="">
      <div style={header}>
        <button
          type="button"
          style={{ ...btn, background: playing ? "#8b5cf6" : "#334155", minWidth: 64 }}
          onClick={togglePlay}
          disabled={!onScrub}
          title={playing ? "Pause preview" : "Play preview"}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <strong style={{ fontSize: 12 }}>Timeline</strong>
        <span style={{ opacity: 0.6, fontSize: 11 }}>
          {value.axis} · {frames} frame{frames === 1 ? "" : "s"}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={addKeyframe}>◆ Keyframe</button>
        <button type="button" style={btn} onClick={addScene}>▣ Scene</button>
        <button type="button" style={btn} onClick={() => onChange({ ...value, frames: frames + 1 })} title="Expand page (add a viewport of scroll length)">＋ Frame</button>
        <button type="button" style={{ ...btn, opacity: frames > 1 ? 1 : 0.4 }} disabled={frames <= 1} onClick={() => onChange({ ...value, frames: frames - 1 })} title="Shrink page">－ Frame</button>
      </div>

      <div
        ref={trackRef}
        style={track}
        onPointerDown={onTrackPointer}
        onPointerMove={onTrackMove}
      >
        {/* frame dividers */}
        {Array.from({ length: frames }, (_, i) => (
          <div key={`f${i}`} style={{ ...frameCell, left: `${(i / frames) * 100}%`, width: `${(1 / frames) * 100}%` }}>
            <span style={frameLabel}>{i + 1}</span>
          </div>
        ))}

        {/* scenes (pinned ranges) — drag the edges to resize, ✕ to remove */}
        {(value.scenes ?? []).map((s) => (
          <div key={s.id} style={{ ...sceneBand, left: `${s.at * 100}%`, width: `${s.length * 100}%` }} title="Scene (pinned) — drag edges to resize">
            <div
              onPointerDown={onSceneHandleDown(s.id, "l")}
              onPointerMove={onSceneHandleMove}
              onPointerUp={onSceneHandleUp}
              style={{ ...sceneHandle, left: -3 }}
            />
            <button
              type="button"
              title="Remove scene"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => removeScene(s.id)}
              style={sceneRemove}
            >
              ✕
            </button>
            <div
              onPointerDown={onSceneHandleDown(s.id, "r")}
              onPointerMove={onSceneHandleMove}
              onPointerUp={onSceneHandleUp}
              style={{ ...sceneHandle, right: -3 }}
            />
          </div>
        ))}

        {/* keyframes */}
        {sorted.map((k) => (
          <button
            key={k.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelectKeyframe?.(k.id)}
            title={`${k.mode} keyframe`}
            style={{
              ...diamond,
              left: `${k.at * 100}%`,
              background: k.mode === "snap" ? "#f59e0b" : "#8b5cf6",
              outline: k.id === selectedKeyframe ? "2px solid #fff" : "none",
            }}
          />
        ))}

        {/* playhead */}
        <div style={{ ...playhead, left: `${clamp01(progress) * 100}%` }} />
      </div>

      {selected ? (
        <div style={kfRow}>
          <span style={{ opacity: 0.7, fontSize: 11 }}>keyframe @ {(selected.at * 100).toFixed(0)}%</span>
          <button
            type="button"
            style={{ ...btn, background: selected.mode === "snap" ? "#f59e0b" : "#334155" }}
            onClick={() => patchKf(selected.id, { mode: selected.mode === "snap" ? "scroll" : "snap" })}
          >
            {selected.mode === "snap" ? "snap" : "scroll"}
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" style={{ ...btn, color: "#fca5a5" }} onClick={() => removeKf(selected.id)}>Delete</button>
        </div>
      ) : null}
    </div>
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

const dock: CSSProperties = {
  background: "#0b1220",
  color: "#e2e8f0",
  borderTop: "1px solid #1e293b",
  padding: "10px 14px 14px",
  fontFamily: "system-ui, sans-serif",
  boxShadow: "0 -8px 24px -12px rgba(0,0,0,0.5)",
};
const header: CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 };
const btn: CSSProperties = {
  font: "inherit",
  fontSize: 11,
  color: "#e2e8f0",
  background: "#334155",
  border: "1px solid #475569",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
};
const track: CSSProperties = {
  position: "relative",
  height: 56,
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  overflow: "hidden",
  cursor: "ew-resize",
};
const frameCell: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  borderRight: "1px solid #1e293b",
  boxSizing: "border-box",
};
const frameLabel: CSSProperties = { position: "absolute", top: 4, left: 6, fontSize: 10, opacity: 0.4 };
const sceneBand: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  background: "rgba(245,158,11,0.14)",
  borderLeft: "1px solid rgba(245,158,11,0.5)",
  borderRight: "1px solid rgba(245,158,11,0.5)",
};
const sceneHandle: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 7,
  cursor: "ew-resize",
  background: "rgba(245,158,11,0.6)",
  touchAction: "none",
};
const sceneRemove: CSSProperties = {
  position: "absolute",
  top: 3,
  right: 9,
  width: 16,
  height: 16,
  lineHeight: "12px",
  fontSize: 10,
  color: "#fff",
  background: "rgba(245,158,11,0.7)",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  padding: 0,
};
const diamond: CSSProperties = {
  position: "absolute",
  top: "50%",
  width: 14,
  height: 14,
  transform: "translate(-50%, -50%) rotate(45deg)",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: 3,
  padding: 0,
  cursor: "pointer",
};
const playhead: CSSProperties = {
  position: "absolute",
  top: -2,
  bottom: -2,
  width: 2,
  marginLeft: -1,
  background: "#38bdf8",
  pointerEvents: "none",
};
const kfRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginTop: 10 };
