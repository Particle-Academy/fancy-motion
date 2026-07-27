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
});

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
