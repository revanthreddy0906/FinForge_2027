import { describe, expect, it, vi } from "vitest";
import { codeStep, passwordStep, type LoginDeps } from "./login-flow";
import { loginCopy } from "./login-state";

const FACTOR = "6f1c1a7e-2b3c-4d5e-8f90-123456789abc";
const session = { access_token: "at", refresh_token: "rt" };

function deps(over: Partial<LoginDeps> = {}): LoginDeps {
  return {
    allowRequest: vi.fn(() => Promise.resolve(true)),
    signInWithPassword: vi.fn(() => Promise.resolve({ ok: true as const, session })),
    prepareFactor: vi.fn(() => Promise.resolve({ kind: "verified" as const, factorId: FACTOR })),
    verifyCode: vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        session: { access_token: "at2", refresh_token: "rt2" },
      }),
    ),
    isOrganizer: vi.fn(() => Promise.resolve(true)),
    saveSession: vi.fn(() => Promise.resolve()),
    clearSession: vi.fn(() => Promise.resolve()),
    ...over,
  };
}

const creds = { email: " Organizer@Example.com ", password: "secret" };

describe("passwordStep", () => {
  it("normalises the email and moves to the code step for an enrolled organizer", async () => {
    const d = deps();
    expect(await passwordStep(creds, "1.1.1.1", d)).toEqual({ step: "verify", factorId: FACTOR });
    expect(d.signInWithPassword).toHaveBeenCalledWith("organizer@example.com", "secret");
    expect(d.saveSession).toHaveBeenCalledWith(session);
  });

  it("shows the QR code step the first time", async () => {
    const d = deps({
      prepareFactor: () =>
        Promise.resolve({
          kind: "needs-enrollment",
          factorId: FACTOR,
          qrCode: "data:image/svg+xml;utf-8,<svg/>",
          secret: "JBSWY3DPEHPK3PXP",
        }),
    });
    const state = await passwordStep(creds, "ip", d);
    expect(state.step).toBe("enroll");
  });

  it("rate limits before checking anything, and fails closed if the limiter errors", async () => {
    const limited = deps({ allowRequest: () => Promise.resolve(false) });
    expect(await passwordStep(creds, "ip", limited)).toEqual({
      step: "password",
      error: loginCopy.rateLimited,
    });
    expect(limited.signInWithPassword).not.toHaveBeenCalled();

    const broken = deps({ allowRequest: () => Promise.reject(new Error("redis down")) });
    expect((await passwordStep(creds, "ip", broken)).step).toBe("password");
    expect(broken.signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows field errors for bad input without calling Supabase", async () => {
    const d = deps();
    const state = await passwordStep({ email: "nope", password: "" }, "ip", d);
    expect(state.step).toBe("password");
    expect(state.step === "password" && state.fieldErrors?.email).toBeTruthy();
    expect(state.step === "password" && state.fieldErrors?.password).toBe("Enter your password.");
    expect(d.signInWithPassword).not.toHaveBeenCalled();
  });

  it("gives one message for a wrong email or password", async () => {
    const d = deps({
      signInWithPassword: () => Promise.resolve({ ok: false, reason: "wrong-credentials" }),
    });
    expect(await passwordStep(creds, "ip", d)).toEqual({
      step: "password",
      error: loginCopy.wrongCredentials,
    });
    expect(d.saveSession).not.toHaveBeenCalled();
  });

  it("clears the half session if the authenticator can't be prepared", async () => {
    const d = deps({ prepareFactor: () => Promise.resolve({ kind: "unavailable" }) });
    expect(await passwordStep(creds, "ip", d)).toEqual({
      step: "password",
      error: loginCopy.unavailable,
    });
    expect(d.clearSession).toHaveBeenCalled();
  });
});

describe("codeStep", () => {
  const verify = { step: "verify" as const, factorId: FACTOR };

  it("opens the console for an organizer and saves the aal2 session", async () => {
    const d = deps();
    expect(await codeStep({ factorId: FACTOR, code: "123 456" }, verify, "ip", d)).toBe("done");
    expect(d.verifyCode).toHaveBeenCalledWith(FACTOR, "123456");
    expect(d.saveSession).toHaveBeenCalledWith({ access_token: "at2", refresh_token: "rt2" });
  });

  it("keeps the step with an error for a wrong or malformed code", async () => {
    const wrong = deps({ verifyCode: () => Promise.resolve({ ok: false, reason: "wrong-code" }) });
    expect(await codeStep({ factorId: FACTOR, code: "000000" }, verify, "ip", wrong)).toEqual({
      ...verify,
      error: loginCopy.wrongCode,
    });
    const d = deps();
    const state = await codeStep({ factorId: FACTOR, code: "12" }, verify, "ip", d);
    expect(state).not.toBe("done");
    expect(state !== "done" && state.step).toBe("verify");
    expect(state !== "done" && state.error).toContain("6-digit");
    expect(d.verifyCode).not.toHaveBeenCalled();
  });

  it("refuses a valid code from someone not on the organizer list", async () => {
    const d = deps({ isOrganizer: () => Promise.resolve(false) });
    expect(await codeStep({ factorId: FACTOR, code: "123456" }, verify, "ip", d)).toEqual({
      step: "password",
      error: loginCopy.notOrganizer,
    });
    expect(d.clearSession).toHaveBeenCalled();
    expect(d.saveSession).not.toHaveBeenCalled();
  });

  it("goes back to the password step when the session is gone", async () => {
    const d = deps({ verifyCode: () => Promise.resolve({ ok: false, reason: "session-lost" }) });
    expect(await codeStep({ factorId: FACTOR, code: "123456" }, verify, "ip", d)).toEqual({
      step: "password",
      error: loginCopy.sessionLost,
    });
  });

  it("rate limits code attempts", async () => {
    const d = deps({ allowRequest: () => Promise.resolve(false) });
    expect(await codeStep({ factorId: FACTOR, code: "123456" }, verify, "ip", d)).toEqual({
      ...verify,
      error: loginCopy.rateLimited,
    });
    expect(d.verifyCode).not.toHaveBeenCalled();
  });

  it("drops a tampered QR code from the previous state", async () => {
    const d = deps({ verifyCode: () => Promise.resolve({ ok: false, reason: "wrong-code" }) });
    const tampered = {
      step: "enroll" as const,
      factorId: FACTOR,
      qrCode: "javascript:alert(1)",
      secret: "JBSWY3DPEHPK3PXP",
    };
    expect(await codeStep({ factorId: FACTOR, code: "123456" }, tampered, "ip", d)).toEqual({
      step: "password",
      error: loginCopy.sessionLost,
    });
  });
});
