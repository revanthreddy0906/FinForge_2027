/**
 * FinForge 2027 design tokens, mirrored 1:1 from the Figma file
 * "FinForge 2027 Design System". Values are in px / ms unless noted.
 *
 * globals.css exposes the same tokens as CSS variables (and Tailwind utilities);
 * tokens.test.ts fails if the two drift apart. Use CSS variables for styling and
 * this module only where JavaScript needs a number (Motion transitions, count-up).
 */
export const tokens = {
  primitives: {
    "teal/950": "#012724",
    "teal/900": "#003a36",
    "teal/800": "#004c47",
    "teal/700": "#00665f",
    "teal/600": "#0b7d74",
    "teal/500": "#1e8c86",
    "teal/400": "#4c9c96",
    "teal/300": "#86bab2",
    "teal/200": "#b4d6d0",
    "teal/100": "#dceeeb",
    "cream/50": "#fcfaf3",
    "cream/100": "#f7f3e6",
    "cream/200": "#e9e2cc",
    "cream/300": "#d6cba9",
    "green/600": "#2f7d4a",
    "green/500": "#3e9a5c",
    "green/400": "#6bc48a",
    "yellow/600": "#d9bf00",
    "yellow/500": "#f5d90a",
    "yellow/400": "#f8e54f",
    "coral/400": "#ff9b8f",
    "red/700": "#b42318",
    "ink/900": "#0b2a27",
  },
  color: {
    "bg/canvas": "teal/950",
    "bg/surface": "teal/900",
    "bg/raised": "teal/800",
    "bg/brand": "teal/700",
    "bg/paper": "cream/100",
    "bg/accent": "yellow/500",
    "bg/accent-hover": "yellow/400",
    "bg/accent-pressed": "yellow/600",
    "text/primary": "cream/100",
    "text/secondary": "teal/200",
    "text/muted": "teal/300",
    "text/accent": "yellow/500",
    "text/on-accent": "teal/950",
    "text/on-paper": "ink/900",
    "text/link-on-paper": "teal/700",
    "text/success": "green/400",
    "text/danger": "coral/400",
    "text/danger-on-paper": "red/700",
    "border/subtle": "teal/800",
    "border/default": "teal/700",
    "border/strong": "teal/300",
    "border/frame": "yellow/500",
    "border/focus": "yellow/400",
    "border/danger": "coral/400",
    "decor/diamond": "green/500",
    "decor/rupee": "teal/400",
  },
  type: {
    "display-xl": {
      font: "display",
      weight: 500,
      mobile: {
        size: 52,
        lineHeight: 52,
        trackingPercent: -1,
      },
      desktop: {
        size: 104,
        lineHeight: 96,
        trackingPercent: -2,
      },
    },
    "display-lg": {
      font: "display",
      weight: 500,
      mobile: {
        size: 44,
        lineHeight: 46,
        trackingPercent: -1,
      },
      desktop: {
        size: 80,
        lineHeight: 80,
        trackingPercent: -1.5,
      },
    },
    "heading-1": {
      font: "display",
      weight: 500,
      mobile: {
        size: 36,
        lineHeight: 40,
        trackingPercent: -0.5,
      },
      desktop: {
        size: 56,
        lineHeight: 60,
        trackingPercent: -1,
      },
    },
    "heading-2": {
      font: "display",
      weight: 500,
      mobile: {
        size: 30,
        lineHeight: 36,
        trackingPercent: -0.25,
      },
      desktop: {
        size: 44,
        lineHeight: 50,
        trackingPercent: -0.5,
      },
    },
    "heading-3": {
      font: "display",
      weight: 500,
      mobile: {
        size: 24,
        lineHeight: 30,
        trackingPercent: 0,
      },
      desktop: {
        size: 30,
        lineHeight: 36,
        trackingPercent: 0,
      },
    },
    "heading-4": {
      font: "body",
      weight: 600,
      mobile: {
        size: 18,
        lineHeight: 26,
        trackingPercent: 0,
      },
      desktop: {
        size: 20,
        lineHeight: 28,
        trackingPercent: 0,
      },
    },
    "body-lg": {
      font: "body",
      weight: 400,
      mobile: {
        size: 18,
        lineHeight: 28,
        trackingPercent: 0,
      },
      desktop: {
        size: 20,
        lineHeight: 32,
        trackingPercent: 0,
      },
    },
    body: {
      font: "body",
      weight: 400,
      mobile: {
        size: 16,
        lineHeight: 26,
        trackingPercent: 0,
      },
      desktop: {
        size: 16,
        lineHeight: 26,
        trackingPercent: 0,
      },
    },
    "body-sm": {
      font: "body",
      weight: 400,
      mobile: {
        size: 14,
        lineHeight: 22,
        trackingPercent: 0,
      },
      desktop: {
        size: 14,
        lineHeight: 22,
        trackingPercent: 0,
      },
    },
    label: {
      font: "body",
      weight: 600,
      mobile: {
        size: 15,
        lineHeight: 20,
        trackingPercent: 0.2,
      },
      desktop: {
        size: 15,
        lineHeight: 20,
        trackingPercent: 0.2,
      },
    },
    eyebrow: {
      font: "body",
      weight: 600,
      mobile: {
        size: 12,
        lineHeight: 16,
        trackingPercent: 16,
      },
      desktop: {
        size: 12,
        lineHeight: 16,
        trackingPercent: 16,
      },
    },
    numeral: {
      font: "display",
      weight: 600,
      mobile: {
        size: 56,
        lineHeight: 56,
        trackingPercent: -1,
      },
      desktop: {
        size: 96,
        lineHeight: 96,
        trackingPercent: -2,
      },
    },
  },
  spacing: {
    "0": 0,
    "2xs": 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 64,
    "4xl": 96,
    "5xl": 128,
    gutter: {
      mobile: 16,
      desktop: 32,
    },
    section: {
      mobile: 72,
      desktop: 128,
    },
  },
  radius: {
    none: 0,
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
  motion: {
    duration: {
      instant: 100,
      fast: 200,
      base: 400,
      slow: 600,
      slower: 800,
      reveal: 1000,
      count: 1600,
    },
    stagger: {
      base: 80,
    },
    distance: {
      reveal: 24,
    },
    easing: {
      "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      "in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  },
} as const;

export type ColorToken = keyof typeof tokens.color;
export type TypeToken = keyof typeof tokens.type;
export type DurationToken = keyof typeof tokens.motion.duration;
export type EasingToken = keyof typeof tokens.motion.easing;

const easings = new Map<string, string>(Object.entries(tokens.motion.easing));
const durations = new Map<string, number>(Object.entries(tokens.motion.duration));

/** Cubic-bezier control points for Motion, parsed from the CSS easing strings. */
export function easingPoints(name: EasingToken): [number, number, number, number] {
  const match = /cubic-bezier\(([^)]+)\)/.exec(easings.get(name) ?? "");
  const parts = match?.[1]?.split(",").map((n) => Number.parseFloat(n));
  if (parts?.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Easing token "${name}" is not a cubic-bezier()`);
  }
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0];
}

/** Motion durations are in seconds; tokens are in milliseconds. */
export function durationSeconds(name: DurationToken): number {
  return (durations.get(name) ?? 0) / 1000;
}
