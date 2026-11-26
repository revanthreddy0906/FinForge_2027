"use client";

import { inView } from "motion";
import { animate } from "motion/mini";
import { useEffect, useRef, type ReactNode } from "react";
import { easingPoints, tokens } from "@/design/tokens";

const reduceQuery = "(prefers-reduced-motion: reduce)";

/**
 * Scroll reveal for one section (docs/motion.md #3). Content is server-rendered
 * fully visible; after hydration, children marked `data-reveal` that are still
 * below the viewport are hidden and then revealed (opacity + translateY, or a
 * scaleX draw for `.reveal-rule`) when the section scrolls into view.
 * Only transform and opacity change, so nothing shifts layout.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    // Already on screen at hydration: leave it alone so nothing flickers.
    if (rect.top < window.innerHeight * 0.9) return;

    const reduce = window.matchMedia(reduceQuery).matches;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const rules = Array.from(root.querySelectorAll<HTMLElement>(".reveal-rule"));
    for (const el of items) {
      el.style.opacity = "0";
      if (!reduce) el.style.transform = `translateY(${String(tokens.motion.distance.reveal)}px)`;
    }
    if (!reduce) for (const el of rules) el.style.transform = "scaleX(0)";

    const ease = easingPoints("out-expo");
    const duration = (reduce ? tokens.motion.duration.fast : tokens.motion.duration.slow) / 1000;
    const stagger = reduce ? 0 : tokens.motion.stagger.base / 1000;

    const stop = inView(
      root,
      () => {
        rules.forEach((el) => {
          el.style.transformOrigin = "left center";
          void animate(el, { transform: ["scaleX(0)", "scaleX(1)"] }, { duration, ease });
        });
        items.forEach((el, i) => {
          const keyframes = reduce
            ? { opacity: [0, 1] }
            : {
                opacity: [0, 1],
                transform: [
                  `translateY(${String(tokens.motion.distance.reveal)}px)`,
                  "translateY(0px)",
                ],
              };
          void animate(el, keyframes, { duration, ease, delay: i * stagger });
        });
      },
      { amount: 0.2 },
    );
    return stop;
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
