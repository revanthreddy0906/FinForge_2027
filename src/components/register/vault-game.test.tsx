import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VaultGame } from "./vault-game";

describe("VaultGame", () => {
  const html = renderToString(<VaultGame dateLabel="20–21 March 2027" />);

  it("is a labelled button with the artwork hidden from screen readers", () => {
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*aria-label="Try to open the registration vault"/,
    );
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders the polite live region with the prompt on the server", () => {
    expect(html).toMatch(/<p[^>]*aria-live="polite"[^>]*>Go on, try the dial\.<\/p>/);
  });

  it("starts with a zero try counter, a ticking dial and the door shut", () => {
    expect(html).toContain("Break-ins tried");
    expect(html).toContain("vault-spin");
    expect(html).not.toContain("is-open");
    expect(html).not.toContain("vault-coin");
    expect(html).not.toContain("vault-jiggle");
  });
});
