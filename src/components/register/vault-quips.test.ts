import { describe, expect, it } from "vitest";
import { nextQuipIndex, vaultPrompt, vaultQuips } from "./vault-quips";

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
    for (const q of [...vaultQuips, vaultPrompt]) {
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
