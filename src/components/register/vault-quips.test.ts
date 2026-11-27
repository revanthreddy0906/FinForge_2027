import { describe, expect, it } from "vitest";
import {
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

describe("vault quips", () => {
  it("starts at the first quip and wraps round", () => {
    expect(nextQuipIndex(-1)).toBe(0);
    expect(nextQuipIndex(vaultQuips.length - 1)).toBe(0);
  });

  it("never shows the same quip twice in a row", () => {
    let i = -1;
    for (let n = 0; n < vaultQuips.length * 2; n++) {
      const next = nextQuipIndex(i);
      expect(next).not.toBe(i);
      i = next;
    }
  });

  it("keeps every line short, unique and free of dates", () => {
    expect(new Set(vaultQuips).size).toBe(vaultQuips.length);
    for (const q of [...vaultQuips, vaultPrompt, welcomeBack(99_999)]) {
      expect(q.length).toBeGreaterThan(0);
      expect(q.length).toBeLessThanOrEqual(60);
      expect(q).not.toMatch(
        /\b(19|20)\d{2}\b|january|february|march|april|may|june|july|august|september|october|november|december/i,
      );
    }
  });

  it("handles an empty list", () => {
    expect(nextQuipIndex(-1, 0)).toBe(-1);
  });
});

describe("try counter", () => {
  it("reads only small whole numbers from storage", () => {
    expect(parseAttempts(null)).toBe(0);
    expect(parseAttempts("")).toBe(0);
    expect(parseAttempts("12")).toBe(12);
    expect(parseAttempts("-3")).toBe(0);
    expect(parseAttempts("1e9")).toBe(0);
    expect(parseAttempts("<img>")).toBe(0);
    expect(parseAttempts("999999")).toBe(0);
  });

  it("caps the count", () => {
    expect(bumpAttempts(0)).toBe(1);
    expect(bumpAttempts(99_999)).toBe(99_999);
  });

  it(`cracks the vault on every ${String(CRACK_EVERY)}th try only`, () => {
    expect(isCrackAttempt(0)).toBe(false);
    expect(isCrackAttempt(CRACK_EVERY - 1)).toBe(false);
    expect(isCrackAttempt(CRACK_EVERY)).toBe(true);
    expect(isCrackAttempt(CRACK_EVERY * 3)).toBe(true);
  });

  it("uses the event's own date label in the crack message", () => {
    expect(crackMessage("20–21 March 2027")).toBe(
      "That's the hacker spirit. Save it for 20–21 March 2027.",
    );
  });
});
