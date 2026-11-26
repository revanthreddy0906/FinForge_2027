"use client";

import { useEffect, useRef } from "react";
import { easingPoints, tokens } from "@/design/tokens";
import { formatINR } from "@/lib/format-inr";

/**
 * Prize count-up (docs/motion.md #5). The final amount is server-rendered and
 * also sizes the box (an invisible copy), so the animated number never changes
 * the layout. Screen readers only ever get the final amount. Motion is loaded
 * lazily when the number scrolls into view.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let controls: { stop: () => void } | undefined;
    let cancelled = false;

    const run = async () => {
      const { animate } = await import("motion");
      if (cancelled) return;
      controls = animate(0, value, {
        duration: tokens.motion.duration.count / 1000,
        ease: easingPoints("out-quart"),
        onUpdate: (latest) => {
          el.textContent = formatINR(Math.round(latest));
        },
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        run().catch(() => {
          el.textContent = formatINR(value);
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      controls?.stop();
    };
  }, [value]);

  const final = formatINR(value);
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className="invisible" aria-hidden="true">
        {final}
      </span>
      <span ref={ref} className="absolute inset-0" aria-hidden="true">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
