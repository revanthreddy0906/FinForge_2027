import type { ComponentProps } from "react";

type FieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

const inputBase =
  "min-h-12 w-full scroll-mt-28 rounded-xs border bg-bg-surface px-md text-body text-text-primary " +
  "placeholder:text-text-muted transition-colors duration-(--duration-fast) ease-standard " +
  "focus-visible:border-border-focus disabled:opacity-40";

/** Figma "Input": label above, optional hint, error below; Default/Focus/Error/Disabled. */
export function Field({ id, label, hint, error, required, ...rest }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="text-label text-text-primary">
        {label}
        {!required && <span className="font-normal text-text-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-body-sm text-text-secondary">
          {hint}
        </p>
      )}
      <input
        {...rest}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${inputBase} ${error ? "border-border-danger" : "border-border-default hover:border-border-strong"}`}
      />
      {error && (
        <p id={errorId} className="flex gap-xs text-body-sm text-text-danger">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
