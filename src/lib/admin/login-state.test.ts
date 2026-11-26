import { describe, expect, it } from "vitest";
import { keepQrCode, withoutQrCode, type LoginState } from "./login-state";

const FACTOR = "6f1c1a7e-2b3c-4d5e-8f90-123456789abc";
const enroll: LoginState = {
  step: "enroll",
  factorId: FACTOR,
  qrCode: "data:image/svg+xml;utf-8,<svg/>",
  secret: "JBSWY3DPEHPK3PXP",
};

describe("QR code handling in the sign-in form", () => {
  it("strips the QR code before the state goes to the server", () => {
    expect(withoutQrCode(enroll)).toEqual({ ...enroll, qrCode: "" });
    expect(withoutQrCode({ step: "password" })).toEqual({ step: "password" });
  });

  it("restores the form's QR code when the server keeps the set-up step", () => {
    const next: LoginState = { ...enroll, qrCode: "", error: "That code didn't work." };
    expect(keepQrCode(enroll, next)).toEqual({ ...enroll, error: "That code didn't work." });
  });

  it("uses a new QR code from the server, and leaves other steps alone", () => {
    const fresh: LoginState = { ...enroll, qrCode: "data:image/svg+xml;utf-8,<svg id='new'/>" };
    expect(keepQrCode(enroll, fresh)).toEqual(fresh);
    expect(keepQrCode(enroll, { step: "password" })).toEqual({ step: "password" });
  });
});
