import { describe, expect, it } from "vitest";
import {
  buildCsp,
  createNonce,
  RAZORPAY_SCRIPT_ORIGIN,
  RAZORPAY_STYLE_HASH,
  securityHeaders,
  TURNSTILE_ORIGIN,
} from "./headers";

function parse(csp: string): Map<string, string[]> {
  return new Map(
    csp.split("; ").map((d) => {
      const [name = "", ...values] = d.split(" ");
      return [name, values];
    }),
  );
}

const base = { nonce: "abc123==", isDev: false, upgradeInsecureRequests: false };

describe("createNonce", () => {
  it("returns 128 random bits as base64, different every call", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(b);
  });
});

describe("buildCsp", () => {
  it("allows scripts only by nonce and strict-dynamic in production", () => {
    const csp = parse(buildCsp(base));
    expect(csp.get("script-src")).toEqual([
      "'self'",
      "'nonce-abc123=='",
      "'strict-dynamic'",
      TURNSTILE_ORIGIN,
    ]);
    expect(buildCsp(base)).not.toContain("unsafe-eval");
    expect(csp.get("script-src")).not.toContain("'unsafe-inline'");
  });

  it("adds unsafe-eval only for next dev", () => {
    expect(parse(buildCsp({ ...base, isDev: true })).get("script-src")).toContain("'unsafe-eval'");
  });

  it("locks down framing, plugins, base URLs and form targets", () => {
    const csp = parse(buildCsp(base));
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("frame-src")).toEqual([TURNSTILE_ORIGIN]);
    expect(csp.get("style-src")).toEqual(["'self'", "'nonce-abc123=='"]);
    expect(csp.get("style-src-attr")).toEqual(["'unsafe-inline'"]);
  });

  it("upgrades insecure requests only when asked", () => {
    expect(parse(buildCsp(base)).has("upgrade-insecure-requests")).toBe(false);
    expect(
      parse(buildCsp({ ...base, upgradeInsecureRequests: true })).has("upgrade-insecure-requests"),
    ).toBe(true);
  });

  it("allows extra https origins for fetch and their wss twins, and ignores anything else", () => {
    const csp = parse(
      buildCsp({
        ...base,
        connectOrigins: ["https://ref.supabase.co", "http://insecure.example", "*"],
      }),
    );
    expect(csp.get("connect-src")).toEqual([
      "'self'",
      "https://ref.supabase.co",
      "wss://ref.supabase.co",
    ]);
  });
});

describe("buildCsp with Razorpay", () => {
  it("leaves Razorpay out unless asked", () => {
    expect(buildCsp(base)).not.toContain("razorpay");
  });

  it("allows the checkout script, its iframe and its reporting endpoint", () => {
    const csp = parse(buildCsp({ ...base, razorpay: true }));
    expect(csp.get("script-src")).toContain(RAZORPAY_SCRIPT_ORIGIN);
    expect(csp.get("script-src")).toContain("'strict-dynamic'");
    expect(csp.get("frame-src")).toEqual([
      TURNSTILE_ORIGIN,
      "https://api.razorpay.com",
      "https://checkout.razorpay.com",
    ]);
    expect(csp.get("connect-src")).toEqual([
      "'self'",
      "https://api.razorpay.com",
      "https://lumberjack.razorpay.com",
    ]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("style-src")).toEqual(["'self'", "'nonce-abc123=='", RAZORPAY_STYLE_HASH]);
  });
});

describe("securityHeaders", () => {
  const byKey = new Map(securityHeaders.map((h) => [h.key, h.value]));

  it("sets the headers securityheaders.com grades", () => {
    expect(byKey.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    for (const f of ["camera=()", "microphone=()", "geolocation=()"]) {
      expect(byKey.get("Permissions-Policy")).toContain(f);
    }
  });
});
