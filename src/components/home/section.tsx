import type { ReactNode } from "react";
import { Reveal } from "../motion/reveal";

interface SectionProps {
  id: string;
  labelledBy: string;
  tone?: "canvas" | "surface";
  children: ReactNode;
}

/** Page section shell: alternating background, section spacing, content width, scroll reveal. */
export function Section({ id, labelledBy, tone = "canvas", children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`scroll-mt-16 px-gutter py-section md:scroll-mt-20 ${tone === "surface" ? "bg-bg-surface" : "bg-bg-canvas"}`}
    >
      <Reveal className="mx-auto flex max-w-content flex-col gap-2xl md:gap-3xl">{children}</Reveal>
    </section>
  );
}
