import { describe, expect, it } from "vitest";
import { fieldName, formDataToInput, turnstileTokenFrom } from "./form-data";

describe("formDataToInput", () => {
  it("reads team fields and members in order, and the consent checkbox", () => {
    const fd = new FormData();
    fd.set(fieldName.teamName, "Hawks");
    fd.set(fieldName.institution, "CBIT");
    fd.set(fieldName.leaderPhone, "9876543210");
    fd.set(fieldName.consent, "on");
    fd.set(fieldName.idempotencyKey, "k");
    fd.set(fieldName.memberName(0), "Asha");
    fd.set(fieldName.memberEmail(0), "a@x.com");
    fd.set(fieldName.memberName(1), "Vik");
    fd.set(fieldName.memberEmail(1), "v@x.com");
    expect(formDataToInput(fd)).toEqual({
      teamName: "Hawks",
      institution: "CBIT",
      leaderPhone: "9876543210",
      consent: true,
      idempotencyKey: "k",
      members: [
        { fullName: "Asha", email: "a@x.com" },
        { fullName: "Vik", email: "v@x.com" },
      ],
    });
  });

  it("never reads more than 5 members and treats a missing checkbox as no consent", () => {
    const fd = new FormData();
    for (let i = 0; i < 8; i++) {
      fd.set(fieldName.memberName(i), `P${String(i)}`);
      fd.set(fieldName.memberEmail(i), `p${String(i)}@x.com`);
    }
    const input = formDataToInput(fd);
    expect(input.members).toHaveLength(5);
    expect(input.consent).toBe(false);
    expect(input.teamName).toBe("");
  });

  it("caps the Turnstile token length", () => {
    const fd = new FormData();
    fd.set(fieldName.turnstileToken, "x".repeat(5000));
    expect(turnstileTokenFrom(fd)).toHaveLength(2048);
  });
});
