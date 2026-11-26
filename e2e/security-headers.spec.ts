import { expect, test } from "./fixtures";

/** Pages that must carry the full header set and render without a single CSP violation. */
const pages = ["/", "/register", "/no-such-page"];

/** Collects CSP violations the browser reports, before any page script runs. */
const recordViolations = `
window.__csp = [];
document.addEventListener("securitypolicyviolation", (e) => {
  window.__csp.push(e.violatedDirective + " blocked " + (e.blockedURI || "inline"));
});`;

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter((parts): parts is [string, ...string[]] => parts[0] !== undefined && parts[0] !== "")
      .map(([name, ...values]) => [name, values]),
  );
}

test.describe("security headers", () => {
  for (const path of pages) {
    test(`${path} sends every security header and a strict CSP`, async ({ request }) => {
      const res = await request.get(path);
      const h = res.headers();

      expect(h["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["cross-origin-opener-policy"]).toBe("same-origin");
      for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) {
        expect(h["permissions-policy"]).toContain(feature);
      }
      expect(h["x-powered-by"]).toBeUndefined();

      const csp = directives(h["content-security-policy"] ?? "");
      const scripts = csp.get("script-src") ?? [];
      expect(scripts).toContain("'strict-dynamic'");
      expect(scripts.some((s) => /^'nonce-[A-Za-z0-9+/=]{20,}'$/.test(s))).toBe(true);
      expect(scripts).not.toContain("'unsafe-inline'");
      expect(scripts).not.toContain("'unsafe-eval'");
      expect(csp.get("object-src")).toEqual(["'none'"]);
      expect(csp.get("base-uri")).toEqual(["'self'"]);
      expect(csp.get("form-action")).toEqual(["'self'"]);
      expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
      expect(csp.get("frame-src")).toEqual(["https://challenges.cloudflare.com"]);
    });
  }

  test("every response gets a fresh nonce, and every script in the page carries it", async ({
    request,
  }) => {
    const nonceOf = (csp: string | undefined) => /'nonce-([^']+)'/.exec(csp ?? "")?.[1];
    const first = await request.get("/");
    const second = await request.get("/");
    const nonce = nonceOf(first.headers()["content-security-policy"]);
    expect(nonce).toBeTruthy();
    expect(nonceOf(second.headers()["content-security-policy"])).not.toBe(nonce);

    const html = await first.text();
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce ?? ""}"`);
  });

  test("static files get the security headers too", async ({ request }) => {
    const res = await request.get("/icon.svg");
    expect(res.ok()).toBe(true);
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["strict-transport-security"]).toContain("max-age=63072000");
  });
});

test.describe("pages under the CSP", () => {
  for (const path of pages) {
    test(`${path} renders, hydrates and animates with no CSP violations`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error" && !m.text().includes("404 (Not Found)")) problems.push(m.text());
      });
      page.on("pageerror", (e) => problems.push(e.message));
      await page.addInitScript(recordViolations);

      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await page.waitForLoadState("load");
      // Scroll so the scroll-triggered Motion animations run under the policy too.
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(600);

      if (path === "/register") {
        // The form loads the Turnstile script itself; strict-dynamic must allow it.
        await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveCount(1);
        // ...and it is handed the page nonce, which Turnstile passes on to what it injects.
        const nonces = await page.evaluate(() => {
          const ts = document.querySelector<HTMLScriptElement>(
            'script[src*="challenges.cloudflare.com"]',
          );
          const own = document.querySelector<HTMLScriptElement>("script[nonce]");
          return [ts?.nonce, own?.nonce];
        });
        expect(nonces[0]).toBeTruthy();
        expect(nonces[0]).toBe(nonces[1]);
      }

      const violations = await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      );
      expect(violations).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
});
