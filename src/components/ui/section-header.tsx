import type { ReactNode } from "react";

interface SectionHeaderProps {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  align?: "left" | "center";
}

/** Figma "Section header". The title is the section's h2 (Heading 1 size). */
export function SectionHeader({
  id,
  index,
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeaderProps) {
  const centered = align === "center";
  return (
    <header
      data-reveal-group
      className={`flex max-w-[45rem] flex-col gap-md ${centered ? "mx-auto items-center text-center" : ""}`}
    >
      <p className="flex items-center gap-sm text-eyebrow uppercase" data-reveal>
        <span className="text-text-muted">{index}</span>
        <span aria-hidden="true" className="reveal-rule h-px w-8 bg-border-frame" />
        <span className="text-text-accent">{eyebrow}</span>
      </p>
      <h2
        id={id}
        className="font-display text-heading-1 text-balance text-text-primary"
        data-reveal
      >
        {title}
      </h2>
      {description && (
        <p className="text-body-lg text-text-secondary" data-reveal>
          {description}
        </p>
      )}
    </header>
  );
}
