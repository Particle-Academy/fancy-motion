// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

import { Reveal } from "../src/react/Reveal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Drive IntersectionObserver by hand — jsdom has none. */
let observers: Array<{ cb: IntersectionObserverCallback; el?: Element; disconnected: boolean }> = [];

function installIO() {
  observers = [];
  class FakeIO {
    private entry: { cb: IntersectionObserverCallback; el?: Element; disconnected: boolean };
    constructor(cb: IntersectionObserverCallback) {
      this.entry = { cb, disconnected: false };
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
