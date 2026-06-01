import { describe, expect, it } from "vitest";
import type { TimelineDoc } from "../src/timeline/types";
import { flattenTimeline, lerpState, sampleTimeline, toCss } from "../src/engine/interpolate";

describe("lerpState", () => {
  it("lerps each prop with sensible defaults", () => {
    const mid = lerpState({ x: 0, opacity: 0 }, { x: 100, opacity: 1 }, 0.5);
    expect(mid.x).toBe(50);
    expect(mid.opacity).toBe(0.5);
    expect(mid.scale).toBe(1); // default on both sides
  });
});

const doc: TimelineDoc = {
  id: "t",
  axis: "vertical",
  frames: 3,
  keyframes: [
    { id: "k0", at: 0, mode: "scroll", snapshot: { hero: { y: 0, opacity: 1 } } },
    { id: "k1", at: 1, mode: "scroll", snapshot: { hero: { y: -200, opacity: 0 } } },
  ],
};

describe("sampleTimeline", () => {
  it("clamps to the first/last keyframe outside the range", () => {
    expect(sampleTimeline(doc, -1).hero).toEqual({ y: 0, opacity: 1 });
    expect(sampleTimeline(doc, 2).hero).toEqual({ y: -200, opacity: 0 });
  });

  it("interpolates between keyframes", () => {
    const s = sampleTimeline(doc, 0.5).hero!;
    expect(s.y).toBe(-100);
    expect(s.opacity).toBe(0.5);
  });
});

describe("flattenTimeline (scenes)", () => {
  it("maps a scene's internal keyframes into its pinned range and sorts", () => {
    const withScene: TimelineDoc = {
      ...doc,
      scenes: [
        {
          id: "s1",
          at: 0.4,
          length: 0.2,
          keyframes: [
            { id: "si0", at: 0, mode: "scroll", snapshot: {} },
            { id: "si1", at: 1, mode: "scroll", snapshot: {} },
          ],
        },
      ],
    };
    const flat = flattenTimeline(withScene);
    const positions = flat.map((k) => Math.round(k.at * 1e6) / 1e6);
    // scene internals land at 0.4 and 0.6, sorted between the base keyframes
    expect(positions).toEqual([0, 0.4, 0.6, 1]);
  });
});

describe("toCss", () => {
  it("emits a transform + opacity", () => {
    const css = toCss({ y: -100, scale: 0.8, opacity: 0.5 });
    expect(css.transform).toBe("translate3d(0px, -100px, 0) scale(0.8) rotate(0deg)");
    expect(css.opacity).toBe(0.5);
  });
});
