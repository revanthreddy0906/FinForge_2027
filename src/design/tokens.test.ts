import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { durationSeconds, easingPoints, tokens } from "./tokens";

// Vitest runs from the repository root.
const css = readFileSync("src/app/globals.css", "utf8");
const [base = "", desktop = ""] = css.split("@media (width >= 48rem)");

/** Value of `--name` in a CSS chunk, or undefined. */
function cssVar(chunk: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // eslint-disable-next-line security/detect-non-literal-regexp -- name comes from the typed token table, escaped above
  return new RegExp(`--${escaped}:\\s*([^;]+);`).exec(chunk)?.[1]?.trim();
}
const rem = (px: number) => (px === 0 ? "0" : `${String(px / 16)}rem`);

function hex(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}
function luminance(h: string): number {
  const [r, g, b] = hex(h).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
const primitives = new Map<string, string>(Object.entries(tokens.primitives));
const semantics = new Map<string, string>(Object.entries(tokens.color));
const resolve = (semantic: keyof typeof tokens.color) =>
  primitives.get(semantics.get(semantic) ?? "") ?? "#000000";

describe("design tokens: CSS mirrors the Figma variables", () => {
  it("defines every primitive with the same value", () => {
    for (const [name, value] of Object.entries(tokens.primitives)) {
      expect(cssVar(base, name.replace("/", "-")), name).toBe(value);
    }
  });

  it("aliases every semantic color to the same primitive", () => {
    for (const [name, primitive] of Object.entries(tokens.color)) {
      expect(cssVar(base, `color-${name.replace("/", "-")}`), name).toBe(
        `var(--${primitive.replace("/", "-")})`,
      );
    }
  });

  it("matches the type scale at mobile and desktop", () => {
    for (const [name, style] of Object.entries(tokens.type)) {
      expect(cssVar(base, `text-${name}`), name).toBe(rem(style.mobile.size));
      expect(cssVar(base, `text-${name}--line-height`), name).toBe(rem(style.mobile.lineHeight));
      const changes = JSON.stringify(style.mobile) !== JSON.stringify(style.desktop);
      expect(cssVar(desktop, `text-${name}`), name).toBe(
        changes ? rem(style.desktop.size) : undefined,
      );
    }
  });

  it("matches spacing, radius and motion", () => {
    for (const [name, value] of Object.entries(tokens.spacing)) {
      const mobile = typeof value === "number" ? value : value.mobile;
      expect(cssVar(base, `spacing-${name}`), name).toBe(rem(mobile));
      if (typeof value !== "number") {
        expect(cssVar(desktop, `spacing-${name}`), name).toBe(rem(value.desktop));
      }
    }
    for (const [name, value] of Object.entries(tokens.radius)) {
      expect(cssVar(base, `radius-${name}`), name).toBe(name === "full" ? "9999px" : rem(value));
    }
    for (const [name, value] of Object.entries(tokens.motion.duration)) {
      expect(cssVar(base, `duration-${name}`), name).toBe(`${String(value)}ms`);
    }
    for (const [name, value] of Object.entries(tokens.motion.easing)) {
      expect(cssVar(base, `ease-${name}`), name).toBe(value);
    }
  });
});

describe("design tokens: WCAG 2.1 AA contrast", () => {
  const canvasPairs = [
    "text/primary",
    "text/secondary",
    "text/muted",
    "text/accent",
    "text/success",
    "text/danger",
  ] as const;

  it.each(["bg/canvas", "bg/surface", "bg/raised"] as const)(
    "body text passes 4.5:1 on %s",
    (bg) => {
      for (const fg of canvasPairs) {
        expect(contrast(resolve(fg), resolve(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("primary and accent text pass on bg/brand (secondary and muted do not, so never use them there)", () => {
    for (const fg of ["text/primary", "text/accent"] as const) {
      expect(contrast(resolve(fg), resolve("bg/brand"))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("text on accent and on paper passes 4.5:1", () => {
    expect(contrast(resolve("text/on-accent"), resolve("bg/accent"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(resolve("text/on-accent"), resolve("bg/accent-hover"))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrast(resolve("text/on-accent"), resolve("bg/accent-pressed")),
    ).toBeGreaterThanOrEqual(4.5);
    for (const fg of ["text/on-paper", "text/link-on-paper", "text/danger-on-paper"] as const) {
      expect(contrast(resolve(fg), resolve("bg/paper")), fg).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("input borders and focus ring pass 3:1 on surfaces", () => {
    for (const border of ["border/strong", "border/focus", "border/danger"] as const) {
      expect(contrast(resolve(border), resolve("bg/surface")), border).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("motion helpers", () => {
  it("parses easing tokens into cubic-bezier points", () => {
    expect(easingPoints("out-expo")).toEqual([0.16, 1, 0.3, 1]);
  });
  it("converts durations to seconds", () => {
    expect(durationSeconds("base")).toBe(0.4);
  });
});
