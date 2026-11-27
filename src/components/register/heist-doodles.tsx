import type { CSSProperties, ReactNode } from "react";

interface ArtProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Hand-drawn doodles around the "coming soon" vault. Server-rendered SVG, decorative only
 * (every piece is aria-hidden by the board). A shared turbulence filter gives the lines a
 * sketched wobble. Pupils carry `heist-pupil` so the eye tracker can move them.
 */

const INK = "var(--color-text-primary)";
const ACCENT = "var(--color-bg-accent)";
const FILL = "var(--color-bg-raised)";
const FILL_DEEP = "var(--color-bg-canvas)";
const MUTED = "var(--color-text-muted)";
const GREEN = "var(--color-decor-diamond)";
const GREEN_LIGHT = "var(--color-text-success)";
const CORAL = "var(--color-text-danger)";

/** The sketch filter, rendered once per page. */
export function RoughFilter() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <filter id="heist-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
        <marker
          id="heist-arrow"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="M1 1 L8 5 L1 9"
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </marker>
      </defs>
    </svg>
  );
}

function Sketch({
  viewBox,
  className,
  style,
  children,
}: ArtProps & {
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={style}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <g filter="url(#heist-rough)">{children}</g>
    </svg>
  );
}

/** CCTV camera on a wall bracket; the lens is a tracked pupil. */
export function CameraArt({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="0 0 200 120" className={className} style={style}>
      <g stroke={INK} strokeWidth="2">
        <path d="M6 4 V54 H56" />
        <rect
          x="46"
          y="34"
          width="120"
          height="52"
          rx="8"
          transform="rotate(18 106 60)"
          fill={FILL}
        />
        <path d="M154 84 l26 10 l-6 30 l-28 -12 z" fill="var(--color-bg-surface)" />
      </g>
      <circle cx="86" cy="46" r="4" fill={CORAL} className="heist-blink" />
      <circle cx="167" cy="101" r="7" fill={ACCENT} className="heist-pupil" />
    </Sketch>
  );
}

/** Dotted cone from the camera lens. */
export function CameraCone({ className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 240 360" className={className} style={style} fill="none" focusable="false">
      <path
        d="M6 4 L236 300 L96 356 Z"
        fill={ACCENT}
        fillOpacity="0.06"
        stroke={ACCENT}
        strokeOpacity="0.25"
        strokeDasharray="4 8"
      />
    </svg>
  );
}

/** Phishing hook on a dotted line, with a bank card caught on it. */
export function HookArt({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="0 0 130 290" className={className} style={style}>
      <g stroke={INK} strokeWidth="2">
        <path d="M80 0 V170" strokeDasharray="1 7" />
        <path d="M80 170 c0 24 -6 40 -24 40 c-16 0 -22 -12 -22 -24 l8 6" />
        <g transform="rotate(-14 60 225)">
          <rect x="8" y="196" width="110" height="64" rx="8" fill="var(--color-bg-brand)" />
          <rect x="22" y="212" width="22" height="16" rx="3" fill={ACCENT} stroke="none" />
          <path
            d="M22 242 h70 M22 250 h40"
            stroke="var(--color-text-secondary)"
            strokeWidth="1.5"
          />
        </g>
      </g>
    </Sketch>
  );
}

/** A masked bandit peeking over a ledge; both pupils follow the pointer. */
export function BanditArt({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="-34 0 188 70" className={className} style={style}>
      <path d="M0 62 C 0 10, 120 10, 120 62" fill={FILL} stroke={INK} strokeWidth="2" />
      <path
        d="M8 46 C 30 28, 90 28, 112 46 C 100 60, 20 60, 8 46 Z"
        fill={FILL_DEEP}
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M14 50 l-18 4 M106 50 l18 4" stroke={INK} strokeWidth="2" />
      <circle cx="38" cy="45" r="8" fill={INK} />
      <circle cx="82" cy="45" r="8" fill={INK} />
      <circle cx="38" cy="45" r="3.5" fill={FILL_DEEP} className="heist-pupil" />
      <circle cx="82" cy="45" r="3.5" fill={FILL_DEEP} className="heist-pupil" />
      <rect x="-32" y="62" width="184" height="4" fill={ACCENT} />
    </Sketch>
  );
}

/** Malware bug with a dotted trail behind it. */
export function BugArt({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="-40 -30 80 60" className={className} style={style}>
      <g transform="rotate(-20)" stroke={MUTED} strokeWidth="2">
        <ellipse rx="18" ry="13" fill="var(--color-bg-surface)" />
        <circle cx="20" r="7" fill="var(--color-bg-surface)" />
        <path d="M-8 -12 l-6 -12 M4 -12 l4 -12 M-8 12 l-6 12 M4 12 l4 12 M24 -5 l10 -8 M24 5 l10 8" />
        <path d="M-10 0 h14" stroke={CORAL} />
      </g>
    </Sketch>
  );
}

export function BugTrail({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="0 0 240 70" className={className} style={style}>
      <path
        d="M2 60 C 80 10, 140 80, 238 30"
        stroke={MUTED}
        strokeWidth="1.6"
        strokeDasharray="2 9"
      />
    </Sketch>
  );
}

/** Shield with a tick: defence wins. */
export function ShieldArt({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="-40 -46 80 92" className={className} style={style}>
      <path
        d="M0 -40 L34 -28 C 34 10, 18 30, 0 42 C -18 30, -34 10, -34 -28 Z"
        fill="var(--color-bg-surface)"
        stroke={GREEN}
        strokeWidth="2"
      />
      <path d="M-12 0 l9 10 l17 -20" stroke={GREEN_LIGHT} strokeWidth="3" />
    </Sketch>
  );
}

export function FingerprintArt({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="-28 -20 56 46" className={className} style={style}>
      <g stroke={MUTED} strokeWidth="1.6">
        <path d="M-22 10 C -22 -20, 22 -20, 22 10" />
        <path d="M-15 14 C -15 -10, 15 -10, 15 14" />
        <path d="M-8 18 C -8 -2, 8 -2, 8 18" />
        <path d="M0 6 v16" />
      </g>
    </Sketch>
  );
}

/** Small four-point sparkle. */
export function SparkleArt({ className, style }: ArtProps) {
  return (
    <svg viewBox="-10 -10 20 20" className={className} style={style} fill="none" focusable="false">
      <path d="M0 -8 V8 M-8 0 H8" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Curved hand-drawn arrow pointing down and left, towards the dial. */
export function ArrowArt({ className, style }: ArtProps) {
  return (
    <Sketch viewBox="0 0 170 140" className={className} style={style}>
      <path
        d="M160 6 C 120 56, 90 96, 10 126"
        stroke={ACCENT}
        strokeWidth="2"
        markerEnd="url(#heist-arrow)"
      />
    </Sketch>
  );
}

/** Security lasers crossing the whole stage, with emitter dots on the edges. */
export function LasersArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 1440 1000"
      preserveAspectRatio="none"
      className={className}
      style={style}
      fill="none"
      focusable="false"
    >
      <g stroke={CORAL} strokeWidth="1.2" vectorEffect="non-scaling-stroke">
        <line x1="0" y1="380" x2="1440" y2="720" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="780" x2="1440" y2="430" vectorEffect="non-scaling-stroke" />
        <line
          x1="0"
          y1="570"
          x2="1440"
          y2="600"
          strokeDasharray="2 10"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
