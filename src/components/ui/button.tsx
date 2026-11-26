import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "group inline-flex min-h-12 items-center justify-center gap-xs rounded-xs px-lg font-body text-label " +
  "transition-[background-color,color,transform] duration-(--duration-fast) ease-standard " +
  "motion-safe:active:scale-[0.98] motion-safe:active:duration-(--duration-instant) " +
  "disabled:pointer-events-none disabled:opacity-40";

const variants = new Map<ButtonVariant, string>([
  [
    "primary",
    "bg-bg-accent text-text-on-accent hover:bg-bg-accent-hover active:bg-bg-accent-pressed",
  ],
  [
    "secondary",
    "border border-border-strong text-text-primary hover:bg-bg-raised active:bg-bg-raised",
  ],
  ["ghost", "text-text-primary hover:text-text-accent active:text-text-accent"],
]);

export function buttonClasses(variant: ButtonVariant = "primary", extra = ""): string {
  return `${base} ${variants.get(variant) ?? ""} ${extra}`.trim();
}

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="transition-transform duration-(--duration-fast) ease-standard motion-safe:group-hover:translate-x-1"
    >
      →
    </span>
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  /** Show the trailing arrow (default true, as in the Figma component). */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}

type LinkButtonProps = CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children">;

/** Figma "Button" rendered as a link (navigation). */
export function ButtonLink({
  variant,
  arrow = true,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link {...rest} className={buttonClasses(variant, className)}>
      <span>{children}</span>
      {arrow && <Arrow />}
    </Link>
  );
}

type NativeButtonProps = CommonProps & Omit<ComponentProps<"button">, "className" | "children">;

/** Figma "Button" rendered as a <button> (actions). */
export function Button({
  variant,
  arrow = false,
  className,
  children,
  type = "button",
  ...rest
}: NativeButtonProps) {
  return (
    <button {...rest} type={type} className={buttonClasses(variant, className)}>
      <span>{children}</span>
      {arrow && <Arrow />}
    </button>
  );
}
