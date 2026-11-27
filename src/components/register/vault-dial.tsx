"use client";

import { useState } from "react";
import { nextQuipIndex, vaultPrompt, vaultQuips } from "./vault-quips";

/**
 * "Coming soon" vault door for /register: a guilloché combination dial that ticks round
 * slowly (CSS steps, transform only). Pressing it jiggles the dial and shows the next quip
 * in a polite live region. Reduced motion: the dial stays still and only the text changes.
 */

const C = 160;

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

export function VaultDial() {
  const [quip, setQuip] = useState(-1);
  const [jiggle, setJiggle] = useState<"" | "vault-jiggle-a" | "vault-jiggle-b">("");

  function tryOpen() {
    setQuip((q) => nextQuipIndex(q));
    // Alternating two class names restarts the shake on every press.
    setJiggle((j) => (j === "vault-jiggle-a" ? "vault-jiggle-b" : "vault-jiggle-a"));
  }

  const text = quip < 0 ? vaultPrompt : (vaultQuips.at(quip) ?? vaultPrompt);

  return (
    <div className="flex w-full flex-col items-center gap-lg">
      <button
        type="button"
        onClick={tryOpen}
        aria-label="Try to open the registration vault"
        className={`relative aspect-square w-full max-w-70 cursor-pointer touch-manipulation rounded-full md:max-w-90 ${jiggle}`}
      >
        <span aria-hidden="true" className="absolute inset-0">
          <Bezel />
          <span className="vault-spin absolute inset-[3%] block">
            <Dial />
          </span>
          <Hub />
        </span>
      </button>
      <p
        id="vault-quip"
        aria-live="polite"
        className="min-h-[4.25rem] max-w-[24rem] text-center font-display text-heading-4 text-text-accent md:min-h-[3.5rem]"
      >
        {text}
      </p>
    </div>
  );
}
