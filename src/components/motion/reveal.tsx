"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { easingPoints, tokens } from "@/design/tokens";

const reduceQuery = "(prefers-reduced-motion: reduce)";

/**
 * Scroll reveal for one section (docs/motion.md #3). Content is server-rendered
 * fully visible; after hydration, children marked `data-reveal` that are still
 * below the viewport are hidden and then revealed (opacity + translateY, or a
 * scaleX draw for `.reveal-rule`) when the section scrolls into view.
 * Only transform and opacity change, so nothing shifts layout. Motion's WAAPI
 * `animate` is loaded lazily, the first time a section actually comes into view.
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
    const distance = `translateY(${String(tokens.motion.distance.reveal)}px)`;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const rules = Array.from(root.querySelectorAll<HTMLElement>(".reveal-rule"));
    for (const el of items) {
      el.style.opacity = "0";
      if (!reduce) el.style.transform = distance;
    }
    if (!reduce) for (const el of rules) el.style.transform = "scaleX(0)";

    const ease = easingPoints("out-expo");
    const duration = (reduce ? tokens.motion.duration.fast : tokens.motion.duration.slow) / 1000;
    const stagger = reduce ? 0 : tokens.motion.stagger.base / 1000;

    const play = async () => {
      const { animate } = await import("motion/mini");
      rules.forEach((el) => {
        el.style.transformOrigin = "left center";
        void animate(el, { transform: ["scaleX(0)", "scaleX(1)"] }, { duration, ease });
      });
      items.forEach((el, i) => {
        const keyframes = reduce
          ? { opacity: [0, 1] }
          : { opacity: [0, 1], transform: [distance, "translateY(0px)"] };
        void animate(el, keyframes, { duration, ease, delay: i * stagger });
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        play().catch(() => {
          // If the chunk fails to load, show the content rather than leave it hidden.
          for (const el of [...items, ...rules]) el.style.removeProperty("opacity");
          for (const el of [...items, ...rules]) el.style.removeProperty("transform");
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
