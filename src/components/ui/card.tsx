import type { ReactNode } from "react";

interface CardProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  highlight?: boolean;
}

/** Figma "Card". Hover lift applies on pointer devices only (Tailwind hover is @media (hover:hover)). */
export function Card({ eyebrow, title, children, highlight = false }: CardProps) {
  return (
    <article
      data-reveal
      className={
        "flex flex-col gap-md rounded-sm border bg-bg-surface p-xl transition-[transform,background-color,border-color] " +
        "duration-(--duration-fast) ease-standard hover:bg-bg-raised motion-safe:hover:-translate-y-1 " +
        (highlight ? "border-border-frame" : "border-border-subtle hover:border-border-strong")
      }
    >
      <span
        aria-hidden="true"
        className={`size-2.5 rotate-45 ${highlight ? "bg-text-accent" : "bg-decor-diamond"}`}
      />
      <p className={`text-eyebrow uppercase ${highlight ? "text-text-accent" : "text-text-muted"}`}>
        {eyebrow}
      </p>
      <h3 className="font-display text-heading-3 text-text-primary">{title}</h3>
      <div className="text-body text-text-secondary">{children}</div>
    </article>
  );
}
