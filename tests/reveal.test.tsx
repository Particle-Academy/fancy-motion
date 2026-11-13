// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createRef, useRef, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

import { Reveal } from "../src/react/Reveal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Drive IntersectionObserver by hand — jsdom has none. */
let observers: Array<{ cb: IntersectionObserverCallback; el?: Element; disconnected: boolean; options?: IntersectionObserverInit }> = [];

function installIO() {
  observers = [];
  class FakeIO {
    private entry: { cb: IntersectionObserverCallback; el?: Element; disconnected: boolean; options?: IntersectionObserverInit };
    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.entry = { cb, disconnected: false, options };
      observers.push(this.entry);
    }
    observe(el: Element) {
      this.entry.el = el;
    }
    disconnect() {
      this.entry.disconnected = true;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIO as unknown as typeof IntersectionObserver);
}

function enterView() {
  act(() => {
    for (const o of observers) {
      if (!o.disconnected) {
        o.cb([{ isIntersecting: true, target: o.el } as IntersectionObserverEntry], {} as IntersectionObserver);
      }
    }
  });
}

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduced && q.includes("prefers-reduced-motion"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return { host, unmount: () => act(() => root.unmount()) };
}

beforeEach(() => {
  installIO();
  setReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * `Reveal` — in-view trigger (#170, task 231).
 *
 * The `kinetic` and `cursor` gallery styles each hand-rolled an
 * IntersectionObserver reveal. It belongs here rather than in react-fancy
 * because this package's whole thesis is that the page is a video and scroll is
 * the playhead — an in-view trigger is that idea at its smallest.
 */
describe("Reveal", () => {
  it("renders children immediately, hidden", () => {
    // The content must be in the DOM from the start: revealing by MOUNTING
    // hides it from search engines and from anyone whose observer never fires.
    const { host, unmount } = mount(<Reveal>content</Reveal>);

    expect(host.textContent).toContain("content");
    expect(host.querySelector("[data-fancy-reveal]")?.getAttribute("data-in-view")).toBe("false");

    unmount();
  });

  it("flips to in-view when it intersects", () => {
    const { host, unmount } = mount(<Reveal>content</Reveal>);

    enterView();

    expect(host.querySelector("[data-fancy-reveal]")?.getAttribute("data-in-view")).toBe("true");

    unmount();
  });

  it("stays revealed once revealed", () => {
    // A reveal that re-hides on scroll-up is a flicker, not an effect.
    const { host, unmount } = mount(<Reveal>content</Reveal>);
    enterView();

    act(() => {
      for (const o of observers) {
        if (!o.disconnected) {
          o.cb([{ isIntersecting: false, target: o.el } as IntersectionObserverEntry], {} as IntersectionObserver);
        }
      }
    });

    expect(host.querySelector("[data-fancy-reveal]")?.getAttribute("data-in-view")).toBe("true");

    unmount();
  });

  it("starts already revealed under prefers-reduced-motion", () => {
    // Not "animates faster" — the content is simply present. Someone who asked
    // the OS for less motion must never be left with hidden content because an
    // observer did not fire.
    setReducedMotion(true);

    const { host, unmount } = mount(<Reveal>content</Reveal>);

    expect(host.querySelector("[data-fancy-reveal]")?.getAttribute("data-in-view")).toBe("true");
    expect(observers.length).toBe(0);

    unmount();
  });

  it("disconnects its observer on unmount", () => {
    // One observer per Reveal, and a gallery page has dozens.
    const { unmount } = mount(<Reveal>content</Reveal>);

    unmount();

    expect(observers.every((o) => o.disconnected)).toBe(true);
  });

  it("forwards className and data-* to the element", () => {
    const { host, unmount } = mount(
      <Reveal className="mine" data-handle="r">
        content
      </Reveal>,
    );

    const el = host.querySelector("[data-fancy-reveal]") as HTMLElement;

    expect(el.className).toContain("mine");
    expect(el.getAttribute("data-handle")).toBe("r");

    unmount();
  });

  it("survives an environment with no IntersectionObserver", () => {
    // SSR and old browsers. Failing open (visible) is the only safe direction.
    vi.stubGlobal("IntersectionObserver", undefined);

    const { host, unmount } = mount(<Reveal>content</Reveal>);

    expect(host.querySelector("[data-fancy-reveal]")?.getAttribute("data-in-view")).toBe("true");

    unmount();
  });
});

/**
 * `root` + `onReveal`.
 *
 * Reveal only ever observed against the viewport. Inside a scroll box that
 * still fires (an observer's intersection is clipped by scrolling ancestors),
 * but `rootMargin` then measures from the window's edge rather than the box's,
 * so "reveal 10% before the bottom" could not be said about a box. And a host
 * had no way to learn that a block revealed short of watching the DOM.
 */
describe("Reveal — root and onReveal", () => {
  it("observes against the given root element", () => {
    const box = document.createElement("div");
    const { unmount } = mount(<Reveal root={box} rootMargin="0px 0px -10%">content</Reveal>);

    expect(observers[0].options?.root).toBe(box);
    expect(observers[0].options?.rootMargin).toBe("0px 0px -10%");

    unmount();
  });

  it("accepts a ref to the root", () => {
    const box = document.createElement("div");
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement | null }).current = box;
    const { unmount } = mount(<Reveal root={ref}>content</Reveal>);

    expect(observers[0].options?.root).toBe(box);

    unmount();
  });

  it("resolves a ref attached in the same render, by its parent", () => {
    // The common shape: the scroll box and its Reveals render together, so the
    // ref is still empty while Reveal renders and only filled at commit.
    function Box() {
      const ref = useRef<HTMLDivElement>(null);
      return (
        <div ref={ref} data-box="">
          <Reveal root={ref}>content</Reveal>
        </div>
      );
    }
    const { host, unmount } = mount(<Box />);

    expect(observers[0].options?.root).toBe(host.querySelector("[data-box]"));

    unmount();
  });

  it("observes the viewport when no root is given", () => {
    const { unmount } = mount(<Reveal>content</Reveal>);

    expect(observers[0].options?.root ?? null).toBeNull();

    unmount();
  });

  it("calls onReveal once, when it reveals", () => {
    const onReveal = vi.fn();
    const { unmount } = mount(<Reveal onReveal={onReveal}>content</Reveal>);
    expect(onReveal).not.toHaveBeenCalled();

    enterView();
    enterView();

    expect(onReveal).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("calls onReveal under reduced motion too, because the content IS revealed", () => {
    setReducedMotion(true);
    const onReveal = vi.fn();
    const { unmount } = mount(<Reveal onReveal={onReveal}>content</Reveal>);

    expect(onReveal).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("does not leak root or onReveal onto the DOM element", () => {
    const box = document.createElement("div");
    const { host, unmount } = mount(<Reveal root={box} onReveal={() => {}}>content</Reveal>);
    const el = host.querySelector("[data-fancy-reveal]") as HTMLElement;

    expect(el.hasAttribute("root")).toBe(false);
    expect(el.hasAttribute("onreveal")).toBe(false);

    unmount();
  });
});
