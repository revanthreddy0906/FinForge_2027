import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { HeistBoard } = await import("./heist-board");
const { event } = await import("@/config/event");

describe("HeistBoard", () => {
  const html = renderToString(<HeistBoard />);

  it("has one h1 that names the state", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>The vault opens/);
  });

  it("links to Instagram in a new tab and says so", () => {
    expect(html).toContain(`href="${event.instagram.url}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("(opens in a new tab)");
  });

  it("keeps every doodle away from screen readers", () => {
    expect(html).toContain("heist-pupil");
    // Decorative captions sit inside aria-hidden wrappers.
    const wrappers = html.match(/aria-hidden="true"/g) ?? [];
    expect(wrappers.length).toBeGreaterThanOrEqual(5);
  });

  it("shows the prize pool in Indian format, never a guessed fact", () => {
    expect(html).toContain("₹3,00,000");
  });
});
