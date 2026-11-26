import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "danger";

const tones = new Map<BadgeTone, string>([
  ["neutral", "border-border-strong text-text-secondary"],
  ["accent", "border-border-frame text-text-accent"],
  ["success", "border-text-success text-text-success"],
  ["danger", "border-border-danger text-text-danger"],
]);

/** Figma "Badge": status pill with the logo's diamond glyph. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full border px-sm py-2xs text-eyebrow uppercase ${tones.get(tone) ?? ""}`}
    >
      <span aria-hidden="true" className="size-1.5 rotate-45 bg-current" />
      {children}
    </span>
  );
}
