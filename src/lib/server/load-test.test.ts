import { describe, expect, it } from "vitest";
import { rateLimitKey } from "./load-test";

const secret = "a".repeat(40);
const valid = { vercelEnv: "preview", secret, header: secret, client: "vu-17" };

describe("rateLimitKey", () => {
  it("keys a load-test request on a preview by its virtual user", () => {
    expect(rateLimitKey("203.0.113.9", valid)).toBe("load-test:vu-17");
  });

  it("is never active in production, even with the secret set and sent", () => {
    expect(rateLimitKey("203.0.113.9", { ...valid, vercelEnv: "production" })).toBe("203.0.113.9");
  });

  it("is off outside Vercel (local and CI builds)", () => {
    expect(rateLimitKey("203.0.113.9", { ...valid, vercelEnv: undefined })).toBe("203.0.113.9");
    expect(rateLimitKey("203.0.113.9", { ...valid, vercelEnv: "development" })).toBe("203.0.113.9");
  });

  it("keeps the IP when the secret is missing, short or wrong", () => {
    expect(rateLimitKey("ip", { ...valid, secret: undefined })).toBe("ip");
    expect(rateLimitKey("ip", { ...valid, secret: "short", header: "short" })).toBe("ip");
    expect(rateLimitKey("ip", { ...valid, header: null })).toBe("ip");
    expect(rateLimitKey("ip", { ...valid, header: "b".repeat(40) })).toBe("ip");
    expect(rateLimitKey("ip", { ...valid, header: `${secret}x` })).toBe("ip");
  });

  it("keeps the IP when the client id is missing or unsafe", () => {
    expect(rateLimitKey("ip", { ...valid, client: null })).toBe("ip");
    expect(rateLimitKey("ip", { ...valid, client: "a:b" })).toBe("ip");
    expect(rateLimitKey("ip", { ...valid, client: "x".repeat(41) })).toBe("ip");
  });
});
