import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VaultDial } from "./vault-dial";
import { vaultPrompt } from "./vault-quips";

describe("VaultDial", () => {
  const html = renderToString(<VaultDial />);

  it("is a labelled button with the artwork hidden from screen readers", () => {
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*aria-label="Try to open the registration vault"/,
    );
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders the polite live region with the prompt on the server", () => {
    expect(html).toMatch(
      /<p[^>]*id="vault-quip"[^>]*aria-live="polite"[^>]*>Go on, try the dial\.<\/p>/,
    );
    expect(html).toContain(vaultPrompt.replace("'", "&#x27;"));
  });

  it("ticks the dial with the spin class only", () => {
    expect(html).toContain("vault-spin");
    expect(html).not.toContain("vault-jiggle");
  });
});
