import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_S, signedInAgeSeconds } from "./admin-session";

describe("signedInAgeSeconds", () => {
  const now = 1_800_000_000;

  it("uses the most recent sign-in method", () => {
    const claims = {
      amr: [
        { method: "password", timestamp: now - 600 },
        { method: "totp", timestamp: now - 500 },
      ],
    };
    expect(signedInAgeSeconds(claims, now)).toBe(500);
  });

  it("treats a token without sign-in times as too old", () => {
    expect(signedInAgeSeconds({}, now)).toBeGreaterThan(SESSION_MAX_AGE_S);
    expect(signedInAgeSeconds({ amr: ["password"] }, now)).toBeGreaterThan(SESSION_MAX_AGE_S);
  });
});
