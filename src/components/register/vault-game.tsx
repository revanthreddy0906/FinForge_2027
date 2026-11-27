"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ATTEMPTS_KEY,
  bumpAttempts,
  CRACK_EVERY,
  crackMessage,
  isCrackAttempt,
  nextQuipIndex,
  parseAttempts,
  vaultPrompt,
  vaultQuips,
  welcomeBack,
} from "./vault-quips";

/**
 * The "coming soon" vault game on /register. A guilloché combination dial ticks round
 * (CSS steps, transform only). Each press jiggles it, shows the next quip and counts the try
 * on this device. Every tenth try the door swings open for a moment and ₹ coins spill out.
 * Reduced motion: nothing moves; the text and counter still change.
 */

const C = 160;
const CRACK_MS = 2800;

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [
    Math.round((C + r * Math.cos(rad)) * 100) / 100,
    Math.round((C + r * Math.sin(rad)) * 100) / 100,
  ];
}

const TICKS = Array.from({ length: 60 }, (_, i) => i);
const NUMBERS = Array.from({ length: 10 }, (_, i) => i);
const RINGS = Array.from({ length: 7 }, (_, i) => i);
/** Where each coin flies to, in px from the centre. Fixed so renders are deterministic. */
const COINS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const dist = 150 + (i % 3) * 40;
  return {
    dx: `${String(Math.round(Math.cos(angle) * dist))}px`,
    dy: `${String(Math.round(Math.sin(angle) * dist))}px`,
    rot: `${String((i % 2 ? 1 : -1) * (90 + i * 20))}deg`,
  };
});

/** Fixed outer bezel with the yellow index mark at 12 o'clock. */
function Bezel() {
  return (
    <svg viewBox="0 0 320 320" className="absolute inset-0 size-full" fill="none">
      <circle cx={C} cy={C} r="157" stroke="var(--color-border-frame)" strokeWidth="1" />
      <circle cx={C} cy={C} r="149" stroke="var(--color-border-default)" strokeWidth="0.75" />
      <path d="M154 2 L166 2 L160 13 Z" fill="var(--color-bg-accent)" />
    </svg>
  );
}

/** What's behind the door: the prize glow. */
function Treasure() {
  return (
    <svg viewBox="0 0 320 320" className="absolute inset-0 size-full" fill="none">
      <circle cx={C} cy={C} r="140" fill="var(--color-bg-canvas)" />
      <circle cx={C} cy={C} r="112" fill="var(--color-bg-accent)" opacity="0.12" />
      <circle cx={C} cy={C} r="80" fill="var(--color-bg-accent)" opacity="0.2" />
      <circle cx={C} cy={C} r="52" fill="var(--color-bg-accent)" />
      <text
        x={C}
        y={C}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-display"
        fontSize="64"
        fill="var(--color-text-on-accent)"
      >
        ₹
      </text>
    </svg>
  );
}

/** The turning part: tick ring, numerals and guilloché rosette. */
function Dial() {
  return (
    <svg viewBox="0 0 320 320" className="size-full" fill="none">
      <circle cx={C} cy={C} r="146" fill="var(--color-bg-surface)" />
      {TICKS.map((i) => {
        const long = i % 6 === 0;
        const [x1, y1] = polar(145, i * 6);
        const [x2, y2] = polar(long ? 133 : 139, i * 6);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={long ? "var(--color-text-primary)" : "var(--color-border-strong)"}
            strokeWidth={long ? 1.5 : 0.75}
          />
        );
      })}
      {NUMBERS.map((i) => {
        const [x, y] = polar(119, i * 36);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(${String(i * 36)} ${String(x)} ${String(y)})`}
            className="font-display"
            fontSize="15"
            fill="var(--color-text-secondary)"
          >
            {String(i * 10)}
          </text>
        );
      })}
      <circle cx={C} cy={C} r="104" stroke="var(--color-border-default)" strokeWidth="0.75" />
      {RINGS.map((i) => {
        const r = 98 - i * 6;
        return (
          <ellipse
            key={i}
            cx={C}
            cy={C}
            rx={r}
            ry={r * 0.62}
            transform={`rotate(${String(i * (180 / RINGS.length))} ${String(C)} ${String(C)})`}
            stroke="var(--color-border-strong)"
            strokeWidth="0.6"
            opacity={0.55 - i * 0.04}
          />
        );
      })}
    </svg>
  );
}

/** Fixed hub with the keyhole, so the centre reads as a lock even mid-turn. */
function Hub() {
  return (
    <svg viewBox="0 0 320 320" className="absolute inset-0 size-full" fill="none">
      <circle cx={C} cy={C} r="46" fill="var(--color-bg-brand)" />
      <circle cx={C} cy={C} r="46" stroke="var(--color-border-frame)" strokeWidth="1" />
      <circle cx={C} cy={C} r="38" stroke="var(--color-border-strong)" strokeWidth="0.6" />
      <circle cx={C} cy="152" r="9" fill="var(--color-bg-paper)" />
      <path d="M155 156 L165 156 L168 178 L152 178 Z" fill="var(--color-bg-paper)" />
    </svg>
  );
}

function readAttempts(): number {
  try {
    return parseAttempts(window.localStorage.getItem(ATTEMPTS_KEY));
  } catch {
    return 0;
  }
}

function saveAttempts(n: number) {
  try {
    window.localStorage.setItem(ATTEMPTS_KEY, String(n));
  } catch {
    // Private mode or storage disabled: the game still works, it just forgets.
  }
}

export function VaultGame({ dateLabel }: { dateLabel: string }) {
  const [attempts, setAttempts] = useState(0);
  const [text, setText] = useState<string>(vaultPrompt);
  const [quip, setQuip] = useState(-1);
  const [jiggle, setJiggle] = useState<"" | "vault-jiggle-a" | "vault-jiggle-b">("");
  const [cracked, setCracked] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Returning visitors: pick the counter up from this device after hydration.
  useEffect(() => {
    const saved = readAttempts();
    if (saved > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
      setAttempts(saved);
      setText(welcomeBack(saved));
    }
    return () => {
      window.clearTimeout(timer.current);
    };
  }, []);

  // The lasers and doodles outside this island react to the crack through a data attribute.
  useEffect(() => {
    const stage = buttonRef.current?.closest<HTMLElement>("[data-heist]");
    if (!stage) return;
    if (cracked) stage.dataset.cracked = "";
    else delete stage.dataset.cracked;
  }, [cracked]);

  function tryOpen() {
    if (cracked) return;
    const n = bumpAttempts(attempts);
    setAttempts(n);
    saveAttempts(n);
    if (isCrackAttempt(n)) {
      setCracked(true);
      setText(crackMessage(dateLabel));
      timer.current = window.setTimeout(() => {
        setCracked(false);
      }, CRACK_MS);
      return;
    }
    const next = nextQuipIndex(quip);
    setQuip(next);
    setText(vaultQuips.at(next) ?? vaultPrompt);
    // Alternating two class names restarts the shake on every press.
    setJiggle((j) => (j === "vault-jiggle-a" ? "vault-jiggle-b" : "vault-jiggle-a"));
  }

  const picks = Math.floor(attempts / CRACK_EVERY);

  return (
    <div className="flex w-full flex-col items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={tryOpen}
        aria-label="Try to open the registration vault"
        className={`relative z-10 aspect-square w-full max-w-72 cursor-pointer touch-manipulation rounded-full md:max-w-104 ${jiggle}`}
      >
        <span aria-hidden="true" className="absolute inset-0">
          <Treasure />
          <span className={`vault-door absolute inset-0 block ${cracked ? "is-open" : ""}`}>
            <span className="vault-spin absolute inset-[3%] block">
              <Dial />
            </span>
            <Hub />
          </span>
          <Bezel />
          {cracked && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              {COINS.map((c, i) => (
                <span
                  key={i}
                  className="vault-coin absolute grid size-9 place-items-center rounded-full border border-border-frame bg-bg-accent font-display text-heading-4 text-text-on-accent"
                  style={{ "--dx": c.dx, "--dy": c.dy, "--rot": c.rot, "--i": i } as CSSProperties}
                >
                  ₹
                </span>
              ))}
            </span>
          )}
        </span>
      </button>

      <p className="mt-lg flex items-center gap-xs text-eyebrow text-text-muted uppercase">
        <span>Break-ins tried</span>
        <span className="min-w-[2ch] text-label text-text-danger tabular-nums">{attempts}</span>
        <span aria-hidden="true">·</span>
        <span>Cracked</span>
        <span className="min-w-[1ch] text-label text-text-danger tabular-nums">{picks}</span>
      </p>
      <p
        aria-live="polite"
        className="hand-note mt-sm min-h-[3.5rem] max-w-[30rem] text-center text-heading-4 text-text-accent"
      >
        {text}
      </p>
    </div>
  );
}
