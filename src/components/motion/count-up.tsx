"use client";

import { animate, inView } from "motion";
import { useEffect, useRef } from "react";
import { easingPoints, tokens } from "@/design/tokens";
import { formatINR } from "@/lib/format-inr";

/**
 * Prize count-up (docs/motion.md #5). The final amount is server-rendered and
 * also sizes the box (an invisible copy), so the animated number never changes
 * the layout. Screen readers only ever get the final amount.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let controls: { stop: () => void } | undefined;
    const stop = inView(
      el,
      () => {
        controls = animate(0, value, {
          duration: tokens.motion.duration.count / 1000,
          ease: easingPoints("out-quart"),
          onUpdate: (latest) => {
            el.textContent = formatINR(Math.round(latest));
          },
        });
      },
      { amount: 0.4 },
    );
    return () => {
      stop();
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
