import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { TimelineDoc } from "../timeline/types";
import { flattenTimeline, sampleKeyframes, toCss } from "../engine/interpolate";

/** An element, or a ref to one, read when the stage mounts. */
export type ElementTarget = HTMLElement | RefObject<HTMLElement | null> | null;

export interface MotionStageProps {
  timeline: TimelineDoc;
  /** Attribute whose value identifies a node to animate (default `data-cms`). */
  nodeAttr?: string;
  className?: string;
  children: ReactNode;
  /**
   * Play from this element's scroll instead of the window's. The spacer and
   * the pin are sized from the element's client box (`frames x clientHeight`)
   * rather than the viewport, and the stage must be inside it. Use it for a
   * stage in a fixed-height box, a modal, a split pane or an editor canvas.
   */
  scrollContainer?: ElementTarget;
  /**
   * Hand the playhead to the host, 0..1. When set, scroll is ignored entirely
   * and no spacer is rendered: the stage is a plain box (size it with
   * `className`) showing the timeline at this position. Drive it from a
   * `TimelineDock`, a slider, a timer or an agent.
   */
  progress?: number;
  /** Called with the playhead (0..1) whenever the stage applies a frame. */
  onProgress?: (progress: number) => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function resolve(target: ElementTarget | undefined): HTMLElement | null {
  if (!target) return null;
  return "current" in target ? target.current : target;
}

/**
 * Runtime player: turns scroll into a timeline playhead and morphs the pinned
 * content between whole-page snapshots. A `frames × viewport` spacer creates the
 * scroll distance; the content is pinned (sticky) and scrubbed by scroll
 * progress (0..1).
 *
 * The scroll root is the window by default, or `scrollContainer`; with
 * `progress` set there is no scroll root at all and the host owns the playhead.
 *
 * Spine scope: continuous **scroll** scrub on the **vertical** axis (the
 * horizontal axis is the symmetric X mapping). Per-keyframe **snap** scrolling
 * and **scene** pinning are runtime behaviors layered on next.
 */
export function MotionStage({
  timeline,
  nodeAttr = "data-cms",
  className,
  children,
  scrollContainer,
  progress,
  onProgress,
}: MotionStageProps) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => flattenTimeline(timeline), [timeline]);
  const horizontal = timeline.axis === "horizontal";
  const controlled = typeof progress === "number";
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  // The container element. Resolved before paint when it already exists, and
  // again after commit: a ref on a PARENT rendered alongside this stage is
  // attached after its children's layout effects, so the first read is empty.
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setContainerEl(controlled ? null : resolve(scrollContainer));
  }, [scrollContainer, controlled]);
  useEffect(() => {
    const el = controlled ? null : resolve(scrollContainer);
    if (el !== containerEl) setContainerEl(el);
  });

  // The container's client size, so the spacer and pin can be sized from it.
  const [box, setBox] = useState<{ el: HTMLElement; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = containerEl;
    if (!el) return setBox(null);
    const measure = () => setBox({ el, w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerEl]);

  const applyAt = (p: number) => {
    const pin = pinRef.current;
    if (!pin) return;
    const snap = sampleKeyframes(flat, p);
    pin.querySelectorAll<HTMLElement>(`[${nodeAttr}]`).forEach((el) => {
      const id = el.getAttribute(nodeAttr);
      const state = id ? snap[id] : undefined;
      if (!state) {
        el.style.transform = "";
        el.style.opacity = "";
        return;
      }
      const css = toCss(state);
      el.style.transform = css.transform;
      el.style.opacity = String(css.opacity);
    });
    onProgressRef.current?.(p);
  };

  // Host-owned playhead.
  useLayoutEffect(() => {
    if (controlled) applyAt(clamp01(progress as number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, progress, flat, nodeAttr]);

  // Scroll-owned playhead: the window, or the container.
  useLayoutEffect(() => {
    if (controlled) return;
    const spacer = spacerRef.current;
    if (!spacer || typeof window === "undefined") return;
    const root = box?.el ?? null;
    if (scrollContainer && !root) return; // container not resolved yet

    let raf = 0;
    const apply = () => {
      raf = 0;
      const rect = spacer.getBoundingClientRect();
      let vp: number;
      let scrolled: number;
      if (root) {
        const r = root.getBoundingClientRect();
        vp = horizontal ? root.clientWidth : root.clientHeight;
        // From the padding edge: a bordered box would otherwise read a border-width early.
        scrolled = horizontal ? r.left + root.clientLeft - rect.left : r.top + root.clientTop - rect.top;
      } else {
        vp = horizontal ? window.innerWidth : window.innerHeight;
        scrolled = horizontal ? -rect.left : -rect.top;
      }
      const total = horizontal ? spacer.offsetWidth : spacer.offsetHeight;
      const len = total - vp;
      applyAt(len > 0 ? clamp01(scrolled / len) : 0);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    const target: HTMLElement | Window = root ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, nodeAttr, horizontal, controlled, box, scrollContainer]);

  if (controlled) {
    return (
      <div
        className={className}
        style={{ position: "relative", overflow: "hidden" }}
        data-fancy-motion-stage=""
        data-progress={clamp01(progress as number).toFixed(2)}
      >
        <div ref={pinRef} style={{ position: "relative", width: "100%", height: "100%" }}>
          {children}
        </div>
      </div>
    );
  }

  const frames = Math.max(1, timeline.frames);
  // Inside a container, one frame is the container's client box; otherwise the viewport.
  const unitH = box ? `${box.h}px` : "100vh";
  const unitW = box ? `${box.w}px` : "100vw";
  const span = (unit: string, viewportUnit: "vh" | "vw") =>
    box ? `${frames * parseFloat(unit)}px` : `${frames * 100}${viewportUnit}`;
  const spacerStyle: CSSProperties = horizontal
    ? { position: "relative", width: span(unitW, "vw"), height: unitH }
    : { position: "relative", height: span(unitH, "vh") };
  const pinStyle: CSSProperties = {
    position: "sticky",
    top: 0,
    left: horizontal ? 0 : undefined,
    height: unitH,
    width: horizontal ? unitW : undefined,
    overflow: "hidden",
  };

  return (
    <div ref={spacerRef} className={className} style={spacerStyle} data-fancy-motion-stage="">
      <div ref={pinRef} style={pinStyle}>
        {children}
      </div>
    </div>
  );
}
