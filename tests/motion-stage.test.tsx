// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createRef, useRef, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

import { MotionStage } from "../src/react/MotionStage";
import { sampleTimeline, toCss } from "../src/engine/interpolate";
import type { TimelineDoc } from "../src/timeline/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `MotionStage` — the runtime player.
 *
 * It only ever read WINDOW scroll, over a `frames x 100vh` spacer, so it could
 * not be contained: a preview in a fixed-height box, a modal, a split pane or
 * an editor canvas had no way to play it. `scrollContainer` plays it from an
 * element's scroll instead, and `progress` hands the playhead to the host
 * outright (a dock, a slider, an agent).
 *
 * jsdom has no layout, so geometry is simulated: the spacer reports a height
 * and its top edge moves up as the (window or container) "scrolls".
 */

const TIMELINE: TimelineDoc = {
  id: "t",
  axis: "vertical",
  frames: 3,
  keyframes: [
    { id: "a", at: 0, mode: "scroll", snapshot: { card: { x: 0, y: 0, rotate: 0 } } },
    { id: "b", at: 1, mode: "scroll", snapshot: { card: { x: 300, y: 100, rotate: 90 } } },
  ],
};

const at = (p: number) => toCss(sampleTimeline(TIMELINE, p).card).transform;

let frames: FrameRequestCallback[] = [];
/** How far the spacer's top edge has moved above its scroll root's top. */
let scrolled = 0;
/** The top of the scroll root, in viewport coordinates (0 for the window). */
let rootTop = 0;

beforeEach(() => {
  frames = [];
  scrolled = 0;
  rootTop = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = this.hasAttribute("data-fancy-motion-stage")
      ? rootTop - scrolled
      : this.hasAttribute("data-scroll-root")
        ? rootTop
        : 0;
    return { top, left: 0, right: 0, bottom: top, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function flush() {
  act(() => {
    const pending = frames;
    frames = [];
    pending.forEach((cb) => cb(0));
  });
}

function mount(el: ReactElement, host: HTMLElement = document.body) {
  const div = document.createElement("div");
  host.append(div);
  const root = createRoot(div);
  act(() => root.render(el));
  return {
    div,
    rerender: (next: ReactElement) => act(() => root.render(next)),
    unmount: () => act(() => root.unmount()),
  };
}

const card = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-motion="card"]')!;

function stage(props: Record<string, unknown> = {}) {
  return (
    <MotionStage timeline={TIMELINE} nodeAttr="data-motion" {...props}>
      <div data-motion="card">card</div>
    </MotionStage>
  );
}

describe("MotionStage — window scroll (unchanged default)", () => {
  it("scrubs from the window", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-fancy-motion-stage") ? 3 * window.innerHeight : 0;
    });
    const { div, unmount } = mount(stage());

    scrolled = window.innerHeight; // half of the 2 x innerHeight scroll length
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flush();

    expect(card(div).style.transform).toBe(at(0.5));
    unmount();
  });
});

describe("MotionStage — scrollContainer", () => {
  function container(height = 400) {
    const box = document.createElement("div");
    box.setAttribute("data-scroll-root", "");
    Object.defineProperty(box, "clientHeight", { configurable: true, value: height });
    Object.defineProperty(box, "clientWidth", { configurable: true, value: 600 });
    document.body.append(box);
    return box;
  }

  it("sizes the spacer and the pin to the container, not the viewport", () => {
    const box = container(400);
    const { div, unmount } = mount(stage({ scrollContainer: box }), box);

    const spacer = div.querySelector<HTMLElement>("[data-fancy-motion-stage]")!;
    expect(spacer.style.height).toBe("1200px"); // 3 frames x 400px
    expect((spacer.firstElementChild as HTMLElement).style.height).toBe("400px");

    unmount();
    box.remove();
  });

  it("plays from the container's scroll, and ignores the window's", () => {
    const box = container(400);
    rootTop = 150; // the box sits partway down the page
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-fancy-motion-stage") ? 1200 : 0;
    });
    const { div, unmount } = mount(stage({ scrollContainer: box }), box);
    flush();
    expect(card(div).style.transform).toBe(at(0));

    scrolled = 400; // 400 / (1200 - 400) = 0.5
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flush();
    expect(card(div).style.transform).toBe(at(0)); // the window is not the playhead

    act(() => {
      box.dispatchEvent(new Event("scroll"));
    });
    flush();
    expect(card(div).style.transform).toBe(at(0.5));

    unmount();
    box.remove();
  });

  it("accepts a ref to the container", () => {
    const box = container(400);
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = box;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-fancy-motion-stage") ? 1200 : 0;
    });
    const { div, unmount } = mount(stage({ scrollContainer: ref }), box);

    scrolled = 800;
    act(() => {
      box.dispatchEvent(new Event("scroll"));
    });
    flush();
    expect(card(div).style.transform).toBe(at(1));

    unmount();
    box.remove();
  });

  it("resolves a ref attached in the same render, by its parent", () => {
    // The common shape: the box and its stage render together. A parent's ref
    // is attached AFTER its children's layout effects run.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-scroll-root") ? 300 : 0;
    });
    function Box() {
      const ref = useRef<HTMLDivElement>(null);
      return (
        <div ref={ref} data-scroll-root="">
          {stage({ scrollContainer: ref })}
        </div>
      );
    }
    const { div, unmount } = mount(<Box />);

    expect(div.querySelector<HTMLElement>("[data-fancy-motion-stage]")!.style.height).toBe("900px");

    unmount();
  });

  it("reports the playhead through onProgress", () => {
    const box = container(400);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-fancy-motion-stage") ? 1200 : 0;
    });
    const onProgress = vi.fn();
    const { unmount } = mount(stage({ scrollContainer: box, onProgress }), box);

    scrolled = 200;
    act(() => {
      box.dispatchEvent(new Event("scroll"));
    });
    flush();
    expect(onProgress).toHaveBeenLastCalledWith(0.25);

    unmount();
    box.remove();
  });
});

describe("MotionStage — external progress", () => {
  it("renders the timeline at the given progress, with no scroll spacer", () => {
    const { div, unmount } = mount(stage({ progress: 0.25 }));

    expect(card(div).style.transform).toBe(at(0.25));
    const root = div.querySelector<HTMLElement>("[data-fancy-motion-stage]")!;
    expect(root.style.height).not.toMatch(/vh$/);
    expect(root.getAttribute("data-progress")).toBe("0.25");

    unmount();
  });

  it("follows the prop, and scroll never moves it", () => {
    const { div, rerender, unmount } = mount(stage({ progress: 0.25 }));

    rerender(stage({ progress: 0.75 }));
    expect(card(div).style.transform).toBe(at(0.75));

    scrolled = 5000;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    flush();
    expect(card(div).style.transform).toBe(at(0.75));

    unmount();
  });

  it("clamps out-of-range progress", () => {
    const { div, unmount } = mount(stage({ progress: 7 }));
    expect(card(div).style.transform).toBe(at(1));
    unmount();
  });
});
