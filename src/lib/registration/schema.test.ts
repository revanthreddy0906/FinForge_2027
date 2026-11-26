import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  fieldErrorsFrom,
  indianMobile,
  registrationSchema,
  toRegisterTeamPayload,
} from "./schema";

const valid = {
  teamName: "  Ledger Hawks ",
  institution: "CBIT",
  leaderPhone: "98765 43210",
  consent: true,
  idempotencyKey: crypto.randomUUID(),
  members: [
    { fullName: "Asha Rao", email: " Asha@Example.com " },
    { fullName: "Vik Reddy", email: "vik@example.com" },
  ],
};

const errorsOf = (input: unknown) => {
  const r = registrationSchema.safeParse(input);
  return r.success ? new Map<string, string>() : fieldErrorsFrom(r.error);
};

describe("registrationSchema", () => {
  it("accepts a valid team and normalises it", () => {
    const r = registrationSchema.parse(valid);
    expect(r.teamName).toBe("Ledger Hawks");
    expect(r.leaderPhone).toBe("+919876543210");
    expect(r.members[0]?.email).toBe("asha@example.com");
  });

  it.each([1, 6])("rejects a team of %i members", (n) => {
    const members = Array.from({ length: n }, (_, i) => ({
      fullName: `Person ${String(i)}`,
      email: `p${String(i)}@example.com`,
    }));
    expect(errorsOf({ ...valid, members }).has("members")).toBe(true);
  });

  it("accepts 5 members", () => {
    const members = Array.from({ length: 5 }, (_, i) => ({
      fullName: `Person ${String(i)}`,
      email: `p${String(i)}@example.com`,
    }));
    expect(registrationSchema.safeParse({ ...valid, members }).success).toBe(true);
  });

  it("flags the second use of an email within a team, on that member", () => {
    const errors = errorsOf({
      ...valid,
      members: [valid.members[0], { fullName: "Twin", email: "ASHA@example.com" }],
    });
    expect(errors.get("members.1.email")).toMatch(/already used for the team leader/);
  });

  it("enforces length limits", () => {
    expect(errorsOf({ ...valid, teamName: "x" }).get("teamName")).toMatch(/at least 2/);
    expect(errorsOf({ ...valid, teamName: "x".repeat(61) }).get("teamName")).toMatch(/60/);
    expect(errorsOf({ ...valid, institution: "   " }).get("institution")).toMatch(/Enter/);
  });

  it("rejects a bad email and requires consent and a uuid key", () => {
    const errors = errorsOf({
      ...valid,
      consent: false,
      idempotencyKey: "nope",
      members: [valid.members[0], { fullName: "Vik", email: "vik@" }],
    });
    expect(errors.get("members.1.email")).toMatch(/name@example.com/);
    expect(errors.has("consent")).toBe(true);
    expect(errors.has("idempotencyKey")).toBe(true);
  });

  it("builds the register_team payload with the leader first", () => {
    const payload = toRegisterTeamPayload(registrationSchema.parse(valid));
    expect(payload).toEqual({
      idempotency_key: valid.idempotencyKey,
      team_name: "Ledger Hawks",
      institution: "CBIT",
      leader_phone: "+919876543210",
      consent_version: CONSENT_VERSION,
      members: [
        { full_name: "Asha Rao", email: "asha@example.com" },
        { full_name: "Vik Reddy", email: "vik@example.com" },
      ],
    });
  });
});

describe("indianMobile", () => {
  it.each([
    "9876543210",
    "98765 43210",
    "+91 98765-43210",
    "+919876543210",
    "09876543210",
    "919876543210",
  ])("accepts %s", (raw) => {
    expect(indianMobile.parse(raw)).toBe("+919876543210");
  });

  it.each(["", "12345", "5876543210", "98765432101", "+1 9876543210", "98765abcde"])(
    "rejects %j",
    (raw) => {
      expect(indianMobile.safeParse(raw).success).toBe(false);
    },
  );
});
