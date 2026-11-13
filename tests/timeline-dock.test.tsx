// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { TimelineDock } from "../src/react/TimelineDock";
import type { TimelineDoc } from "../src/timeline/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(el));
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

const doc: TimelineDoc = {
  frames: 3,
  keyframes: [
    { id: "k1", at: 0, mode: "snap" },
    { id: "k2", at: 0.5, mode: "scroll" },
  ],
  scenes: [],
} as TimelineDoc;

/**
 * The dock's controls are nameable, and the track is operable.
 *
 * Nothing here could have found out before: the package's only suite tested
 * `interpolate`, there was no jsdom, and neither React component could be
 * rendered. So a keyframe marker shipped as `<button style={diamond} />` — an
 * element with **no content whatsoever** — and every keyframe on the timeline
 * announced itself as "button".
 */
describe("TimelineDock accessibility", () => {
  it("names every keyframe marker, which had no content at all", () => {
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} />);

    const markers = [...host.querySelectorAll("[data-fmo-keyframe]")];
    expect(markers).toHaveLength(2);

    for (const m of markers) {
      expect(m.getAttribute("aria-label")).toMatch(/keyframe at \d+%/);
    }
  });

  it("says which keyframe is selected, not only in the outline", () => {
    // Selection was communicated by a white CSS outline and nothing else.
    const host = mount(
      <TimelineDock value={doc} onChange={vi.fn()} selectedKeyframe="k2" onSelectKeyframe={vi.fn()} />,
    );

    const selected = host.querySelectorAll('[data-fmo-keyframe][aria-pressed="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute("data-fmo-keyframe")).toBe("k2");
  });

  it("leaves no control without an accessible name", () => {
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} onScrub={vi.fn()} />);

    const unnamed = [...host.querySelectorAll("button")].filter(
      (b) => !b.getAttribute("aria-label") && !(b.textContent ?? "").trim(),
    );
    expect(unnamed).toHaveLength(0);
  });

  it("exposes the track as a slider carrying its position", () => {
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} progress={0.25} onScrub={vi.fn()} />);

    const track = host.querySelector('[data-fmo-track][role="slider"]');
    expect(track).not.toBeNull();
    expect(track!.getAttribute("aria-valuenow")).toBe("25");
  });

  it("scrubs with the keyboard, which a bare div could never do", () => {
    const onScrub = vi.fn();
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} progress={0.5} onScrub={onScrub} />);
    const track = host.querySelector("[data-fmo-track]")!;

    act(() => {
      track.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(onScrub).toHaveBeenLastCalledWith(0.52);

    act(() => {
      track.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    expect(onScrub).toHaveBeenLastCalledWith(0);
  });

  it("is not focusable when there is nothing to scrub", () => {
    // A tab stop that does nothing is worse than no tab stop.
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} />);

    expect(host.querySelector("[data-fmo-track]")!.getAttribute("tabindex")).toBe("-1");
  });

  it("nests no control inside the slider", () => {
    // axe nested-interactive (lab run 601, K33): the keyframe markers and the
    // scene remove buttons sat INSIDE role="slider", so a screen reader
    // flattened them into the slider and could not reach them as buttons.
    const withScene = { ...doc, scenes: [{ id: "s1", at: 0.2, length: 0.2, keyframes: [] }] } as TimelineDoc;
    const host = mount(<TimelineDock value={withScene} onChange={vi.fn()} onScrub={vi.fn()} />);

    const slider = host.querySelector('[role="slider"]')!;
    expect(slider.querySelectorAll("button, [tabindex], input, a[href]")).toHaveLength(0);
    // ...and the controls still exist, beside it.
    expect(host.querySelectorAll("[data-fmo-keyframe]")).toHaveLength(2);
    expect(host.querySelectorAll("[data-fmo-scene-remove]")).toHaveLength(1);
  });

  it("draws frame numbers at a readable contrast by default", () => {
    // The labels were the dock foreground at opacity 0.4 on the track:
    // 3.32:1 at 10px (axe color-contrast, lab run 601, K33).
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} />);
    const label = host.querySelector<HTMLElement>("[data-fmo-frame-label]")!;
    expect(label).not.toBeNull();
    expect(label.style.opacity === "" || Number(label.style.opacity) === 1).toBe(true);

    const fallback = (css: string) => /var\(--[\w-]+, (#[0-9a-f]{6})\)/i.exec(css)?.[1];
    const fg = fallback(label.style.color);
    const bg = fallback(host.querySelector<HTMLElement>("[data-fmo-track-area]")!.style.background);
    expect(fg).toBeDefined();
    expect(bg).toBeDefined();
    expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });
});

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/**
 * The dock themes through `--fmo-*`.
 *
 * Every colour was a hardcoded slate hex, so a host could not retheme the
 * timeline at all. It still defaults to dark — it is editor chrome over a live
 * page — but that is now a default rather than a hard-coding, matching how
 * fancy-flow and fancy-cms-ui solve the same problem.
 */
describe("theming", () => {
  it("resolves its chrome from tokens with the old values as fallbacks", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("src/react/TimelineDock.tsx", "utf8");

    for (const token of ["--fmo-surface", "--fmo-fg", "--fmo-border", "--fmo-track", "--fmo-accent"]) {
      expect(source).toContain(`var(${token},`);
    }

    // The literals these replaced must be gone from the style objects, or a
    // half-tokenised dock reads as themeable and is not.
    expect(source).not.toMatch(/background: "#0b1220"/);
    expect(source).not.toMatch(/background: "#0f172a"/);
  });
});

/**
 * A keyframe marker shows keyboard focus.
 *
 * Measured in Chromium with real Tab presses (375 / 768 / 1280 px): a focused
 * marker had computed outline-style `none` and no box-shadow, because its INLINE
 * style set `outline: "none"` whenever it was not the selected keyframe. An
 * inline declaration beats any stylesheet `:focus-visible` rule, so nothing a
 * host or the kit shipped could put a ring back.
 *
 * jsdom does not evaluate `:focus-visible`, so this checks the two halves a
 * browser combines: the inline style no longer pins the outline, and a rule in
 * the document matches the rendered marker on `:focus-visible` with the kit
 * focus token.
 */
describe("keyframe marker focus", () => {
  function focusVisibleRules(el: Element): CSSStyleRule[] {
    const out: CSSStyleRule[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const r of Array.from(rules)) {
        if ("selectorText" in r) {
          const rule = r as CSSStyleRule;
          const hit = rule.selectorText
            .split(",")
            .map((s) => s.trim())
            .some((s) => s.includes(":focus-visible") && el.matches(s.replace(/:focus-visible/g, "")));
          if (hit) out.push(rule);
        } else if ("cssRules" in r) walk((r as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
    return out;
  }

  it("does not pin the outline inline, selected or not", () => {
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} selectedKeyframe="k2" onSelectKeyframe={vi.fn()} />);
    for (const m of host.querySelectorAll<HTMLElement>("[data-fmo-keyframe]")) {
      expect(m.style.outline, m.dataset.fmoKeyframe).toBe("");
      expect(m.style.outlineStyle, m.dataset.fmoKeyframe).toBe("");
    }
  });

  it("draws the kit focus ring on :focus-visible", () => {
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} />);
    for (const m of host.querySelectorAll<HTMLElement>("[data-fmo-keyframe]")) {
      const ring = focusVisibleRules(m).find(
        (r) =>
          r.style.getPropertyValue("outline-style") === "solid" &&
          parseFloat(r.style.getPropertyValue("outline-width")) > 0 &&
          r.style.getPropertyValue("outline-color").includes("--fancy-focus"),
      );
      expect(ring, `no :focus-visible ring for ${m.dataset.fmoKeyframe}`).toBeDefined();
    }
  });

  it("uses the dark focus token in a dark host", () => {
    const wrap = document.createElement("div");
    wrap.className = "dark";
    document.body.append(wrap);
    const root = createRoot(wrap);
    act(() => root.render(<TimelineDock value={doc} onChange={vi.fn()} />));
    const m = wrap.querySelector("[data-fmo-keyframe]")!;
    const dark = focusVisibleRules(m).find((r) => r.style.getPropertyValue("outline-color").includes("--fancy-focus-dark"));
    expect(dark).toBeDefined();
  });

  it("still marks the selected keyframe, and only that one", () => {
    const host = mount(<TimelineDock value={doc} onChange={vi.fn()} selectedKeyframe="k2" onSelectKeyframe={vi.fn()} />);
    const k1 = host.querySelector<HTMLElement>('[data-fmo-keyframe="k1"]')!;
    const k2 = host.querySelector<HTMLElement>('[data-fmo-keyframe="k2"]')!;
    expect(k2.style.boxShadow).not.toBe("");
    expect(k1.style.boxShadow).toBe("");
  });
});
