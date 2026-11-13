import { forwardRef, useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type RefObject } from "react";

export interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /**
   * How much of the element must be visible before it reveals, 0–1.
   * Default `0.15` — enough that a tall block does not trigger on its first
   * pixel, low enough that a short one still fires.
   */
  amount?: number;
  /**
   * Margin around the root (the viewport, or `root`) when testing
   * intersection, e.g. `"0px 0px -10%"`.
   */
  rootMargin?: string;
  /**
   * The scroll container to observe against, or a ref to it. Default: the
   * viewport. A Reveal inside a scroll box already fires without this (an
   * observer's intersection is clipped by scrolling ancestors), but only with
   * `root` does `rootMargin` measure from the box's edges.
   */
  root?: Element | RefObject<Element | null> | null;
  /**
   * Called once, when the block reveals. Also called on mount under
   * `prefers-reduced-motion` and where there is no IntersectionObserver,
   * because the block is revealed from the start there.
   */
  onReveal?: () => void;
}

/**
 * Reveal children once they scroll into view.
 *
 * The `kinetic` and `cursor` gallery styles each hand-rolled this with an
 * IntersectionObserver. It lives here rather than in react-fancy because this
 * package's thesis is that the page is a video and scroll is the playhead — an
 * in-view trigger is that idea at its smallest.
 *
 * Three decisions worth stating, because each is a way this component is
 * commonly written wrong:
 *
 * 1. **Children are always rendered**, and revealing only flips `data-in-view`.
 *    Revealing by *mounting* hides the content from search engines and from
 *    anyone whose observer never fires.
 * 2. **It fails OPEN.** No `IntersectionObserver` (SSR, older browsers) means
 *    revealed, not hidden. The failure mode of the alternative is a blank page.
 * 3. **`prefers-reduced-motion` starts revealed and never observes at all.**
 *    Not "animates faster" — someone who asked the OS for less motion should not
 *    depend on a scroll event to see content.
 *
 * Styling is left to the consumer via `[data-in-view]`, so a design can
 * transition opacity, transform, clip-path or nothing at all:
 *
 * ```css
 * [data-fancy-reveal] { opacity: 0; transition: opacity .5s }
 * [data-fancy-reveal][data-in-view="true"] { opacity: 1 }
 * ```
 */
export const Reveal = forwardRef<HTMLDivElement, RevealProps>(
  ({ children, amount = 0.15, rootMargin, root, onReveal, className, ...props }, forwardedRef) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [inView, setInView] = useState(false);
    // Read through a ref so a new callback each render neither re-observes nor re-fires.
    const onRevealRef = useRef(onReveal);
    onRevealRef.current = onReveal;
    const fired = useRef(false);
    const reveal = () => {
      setInView(true);
      if (!fired.current) {
        fired.current = true;
        onRevealRef.current?.();
      }
    };

    useEffect(() => {
      // Reduced motion, or an environment without the API: show it and stop.
      const reduced =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced || typeof IntersectionObserver === "undefined") {
        reveal();
        return;
      }

      const el = ref.current;
      if (!el) return;

      // Resolved HERE, not during render: a ref to a parent rendered alongside
      // this Reveal is still empty while it renders and only filled at commit,
      // which is before effects run.
      const rootElement = root && "current" in root ? root.current : (root ?? null);

      const io = new IntersectionObserver(
        (entries) => {
          // Latch: a reveal that re-hides on scroll-up is a flicker.
          if (entries.some((e) => e.isIntersecting)) {
            reveal();
            io.disconnect();
          }
        },
        { threshold: amount, rootMargin, root: rootElement },
      );

      io.observe(el);
      return () => io.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount, rootMargin, root]);

    return (
      <div
        ref={(node) => {
          ref.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        {...props}
        data-fancy-reveal=""
        data-in-view={inView ? "true" : "false"}
        className={className}
      >
        {children}
      </div>
    );
  },
);

Reveal.displayName = "Reveal";
