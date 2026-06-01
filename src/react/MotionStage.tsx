import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import type { TimelineDoc } from "../timeline/types";
import { flattenTimeline, sampleKeyframes, toCss } from "../engine/interpolate";

export interface MotionStageProps {
  timeline: TimelineDoc;
  /** Attribute whose value identifies a node to animate (default `data-cms`). */
  nodeAttr?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Runtime player: turns scroll into a timeline playhead and morphs the pinned
 * content between whole-page snapshots. A `frames × viewport` spacer creates the
 * scroll distance; the content is pinned (sticky) and scrubbed by scroll
 * progress (0..1).
 *
 * Spine scope: continuous **scroll** scrub on the **vertical** axis (the
 * horizontal axis is the symmetric X mapping). Per-keyframe **snap** scrolling
 * and **scene** pinning are runtime behaviors layered on next.
 */
export function MotionStage({ timeline, nodeAttr = "data-cms", className, children }: MotionStageProps) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => flattenTimeline(timeline), [timeline]);
  const horizontal = timeline.axis === "horizontal";

  useLayoutEffect(() => {
    const spacer = spacerRef.current;
    const pin = pinRef.current;
    if (!spacer || !pin || typeof window === "undefined") return;

    let raf = 0;
    const apply = () => {
      raf = 0;
      const rect = spacer.getBoundingClientRect();
      const vp = horizontal ? window.innerWidth : window.innerHeight;
      const total = horizontal ? spacer.offsetWidth : spacer.offsetHeight;
      const scrolled = horizontal ? -rect.left : -rect.top;
      const len = total - vp;
      const progress = len > 0 ? Math.min(1, Math.max(0, scrolled / len)) : 0;

      const snap = sampleKeyframes(flat, progress);
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
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [flat, nodeAttr, horizontal]);

  const frames = Math.max(1, timeline.frames);
  const spacerStyle: CSSProperties = horizontal
    ? { position: "relative", width: `${frames * 100}vw`, height: "100vh" }
    : { position: "relative", height: `${frames * 100}vh` };
  const pinStyle: CSSProperties = {
    position: "sticky",
    top: 0,
    left: horizontal ? 0 : undefined,
    height: "100vh",
    width: horizontal ? "100vw" : undefined,
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
