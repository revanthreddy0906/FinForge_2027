/**
 * Figma "Logo": typographic stand-in for the FinForge lockup.
 * TODO: swap the mark for the official SVG once it is supplied.
 */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-sm">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full bg-bg-brand font-display text-[1.375rem] leading-none text-decor-rupee"
      >
        ₹
      </span>
      <span className="flex flex-col">
        <span className="font-display text-[1.5rem] leading-[1.625rem] font-medium text-text-primary">
          FinForge
        </span>{" "}
        <span className="text-eyebrow text-text-accent">2027</span>
      </span>
    </span>
  );
}
