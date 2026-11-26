import { describe, expect, it } from "vitest";
import { parseHostnames, rejectReason, TURNSTILE_ACTION } from "./turnstile-check";

const ok = {
  success: true,
  action: TURNSTILE_ACTION,
  hostname: "finforge2027.vercel.app",
  errorCodes: [],
};

describe("parseHostnames", () => {
  it("splits, trims, lowercases and drops blanks", () => {
    expect([...parseHostnames(" A.example , b.example,, ")]).toEqual(["a.example", "b.example"]);
  });
  it("is empty when unset", () => {
    expect(parseHostnames(undefined).size).toBe(0);
    expect(parseHostnames("").size).toBe(0);
  });
});

describe("rejectReason", () => {
  const prod = parseHostnames("finforge2027.vercel.app");

  it("accepts a valid token from an allowed hostname with the right action", () => {
    expect(rejectReason(ok, prod)).toBeNull();
  });
  it("reports Cloudflare's error codes on failure", () => {
    expect(rejectReason({ success: false, errorCodes: ["invalid-input-secret"] }, prod)).toBe(
      "verification failed: invalid-input-secret",
    );
    expect(rejectReason({ success: false, errorCodes: [] }, prod)).toBe(
      "verification failed: none",
    );
  });
  it("rejects a token minted for another action", () => {
    expect(rejectReason({ ...ok, action: "login" }, prod)).toBe("unexpected action: login");
    expect(rejectReason({ ...ok, action: undefined }, prod)).toBe("unexpected action: none");
  });
  it("rejects a token from a hostname that isn't allowed", () => {
    expect(rejectReason({ ...ok, hostname: "localhost" }, prod)).toBe(
      "unexpected hostname: localhost",
    );
    expect(rejectReason({ ...ok, hostname: undefined }, prod)).toBe("unexpected hostname: none");
  });
  it("only checks success when no hostnames are configured (test keys)", () => {
    expect(rejectReason({ success: true, errorCodes: [] }, new Set())).toBeNull();
    expect(rejectReason({ success: false, errorCodes: [] }, new Set())).not.toBeNull();
  });
});
