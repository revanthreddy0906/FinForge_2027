import type { CSSProperties } from "react";

/**
 * Hero seal: guilloché rings around the ₹ coin from the FinForge logo.
 * Animated with CSS only (docs/motion.md #2) so the hero never waits for JS.
 */
const RINGS = Array.from({ length: 9 }, (_, i) => i);

export function Seal() {
  return (
    <div aria-hidden="true" className="seal relative aspect-square w-70 shrink-0 md:w-80 xl:w-110">
      <svg
        viewBox="0 0 440 440"
        className="absolute inset-0 size-full overflow-visible"
        fill="none"
      >
        {RINGS.map((i) => {
          const r = 220 - i * 13.2;
          return (
            <g key={i} transform={`rotate(${String(i * 11)} 220 220)`}>
              <ellipse
                className="seal-ring"
                style={{ "--i": i } as CSSProperties}
                cx="220"
                cy="220"
                rx={r}
                ry={i % 2 ? r * 0.92 : r}
                stroke={i === 0 ? "var(--color-border-frame)" : "var(--color-border-default)"}
                strokeWidth={i === 0 ? 1 : 0.75}
                opacity={i === 0 ? 0.9 : 0.7 - i * 0.04}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
      <div className="seal-coin absolute inset-[24%] grid place-items-center rounded-full bg-bg-brand">
        <span className="seal-rupee font-display text-[6rem] leading-none text-decor-rupee md:text-[6.75rem] xl:text-[9rem]">
          ₹
        </span>
      </div>
      {["top-[6%] left-1/2", "top-1/2 left-[94%]", "top-[94%] left-1/2", "top-1/2 left-[6%]"].map(
        (pos, i) => (
          <span
            key={pos}
            className={`seal-diamond absolute size-2 -translate-1/2 rotate-45 bg-decor-diamond md:size-2.5 ${pos}`}
            style={{ "--i": i } as CSSProperties}
          />
        ),
      )}
    </div>
  );
}
