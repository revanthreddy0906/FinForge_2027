import { describe, expect, it, vi } from "vitest";
import type { PaymentStart, StartOutcome } from "@/lib/payments/flow";
import { copy, registerTeam, type RegisterDeps, type SaveOutcome } from "./register";

const input = {
  teamName: "Ledger Hawks",
  institution: "CBIT",
  leaderPhone: "9876543210",
  consent: true,
  idempotencyKey: crypto.randomUUID(),
  members: [
    { fullName: "Asha Rao", email: "asha@example.com" },
    { fullName: "Vik Reddy", email: "vik@example.com" },
  ],
};

const payment: PaymentStart = {
  keyId: "rzp_test_abc",
  orderId: "order_ABC123",
  amountPaise: 139800,
  memberCount: 2,
  reference: "FF27-0007",
  teamName: "Ledger Hawks",
  prefill: { name: "Asha Rao", email: "asha@example.com", contact: "+919876543210" },
};

function deps(overrides: Partial<RegisterDeps> = {}, save?: SaveOutcome) {
  return {
    registrationState: () => "open" as const,
    allowRequest: vi.fn(() => Promise.resolve(true)),
    verifyHuman: vi.fn(() => Promise.resolve(true)),
    saveTeam: vi.fn(() =>
      Promise.resolve<SaveOutcome>(
        save ?? { ok: true, teamId: "team-1", reference: "FF27-0007", created: true },
      ),
    ),
    startPayment: vi.fn(() => Promise.resolve<StartOutcome>({ kind: "pay", payment })),
    ...overrides,
  } satisfies RegisterDeps;
}

describe("registerTeam", () => {
  it("saves a valid team and moves on to payment for that team", async () => {
    const d = deps();
    const result = await registerTeam(input, "token", "1.2.3.4", d);
    expect(result).toEqual({ status: "payment", payment });
    expect(d.verifyHuman).toHaveBeenCalledWith("token", "1.2.3.4");
    expect(d.saveTeam).toHaveBeenCalledWith(
      expect.objectContaining({ leader_phone: "+919876543210", team_name: "Ledger Hawks" }),
    );
    expect(d.startPayment).toHaveBeenCalledWith("team-1");
  });

  it("a replay of the same team goes back to its payment", async () => {
    const d = deps({}, { ok: true, teamId: "team-1", reference: "FF27-0007", created: false });
    const result = await registerTeam(input, "token", "ip", d);
    expect(result).toEqual({ status: "payment", payment });
    expect(d.startPayment).toHaveBeenCalledWith("team-1");
  });

  it("a replay of a team that already paid shows it as confirmed", async () => {
    const d = deps({
      startPayment: vi.fn(() =>
        Promise.resolve<StartOutcome>({
          kind: "paid",
          reference: "FF27-0007",
          teamName: "Ledger Hawks",
        }),
      ),
    });
    expect(await registerTeam(input, "token", "ip", d)).toEqual({
      status: "success",
      reference: "FF27-0007",
      teamName: "Ledger Hawks",
    });
  });

  it("says the team is saved when the payment can't start", async () => {
    const d = deps({
      startPayment: vi.fn(() => Promise.resolve<StartOutcome>({ kind: "unavailable" })),
    });
    expect(await registerTeam(input, "token", "ip", d)).toMatchObject({
      status: "error",
      message: copy.paymentUnavailable,
    });
  });

  it("maps a name held by an unpaid team to the team name field", async () => {
    const result = await registerTeam(
      input,
      "t",
      "ip",
      deps({}, { ok: false, code: "team_name_held" }),
    );
    expect(result.status === "error" && result.fieldErrors.get("teamName")).toBe(copy.teamNameHeld);
  });

  it("maps an email held by an unpaid team to the member who used it", async () => {
    const result = await registerTeam(
      input,
      "t",
      "ip",
      deps({}, { ok: false, code: "email_held", detail: "vik@example.com" }),
    );
    expect(result.status === "error" && result.fieldErrors.get("members.1.email")).toBe(
      copy.emailHeld,
    );
  });

  it.each([
    ["coming-soon", copy.notOpen["coming-soon"]],
    ["closed", copy.notOpen.closed],
  ] as const)("refuses when registration is %s, before any other work", async (state, message) => {
    const d = deps({ registrationState: () => state });
    const result = await registerTeam(input, "token", "ip", d);
    expect(result).toMatchObject({ status: "error", message });
    expect(d.allowRequest).not.toHaveBeenCalled();
    expect(d.saveTeam).not.toHaveBeenCalled();
  });

  it("rate limits before validating or saving", async () => {
    const d = deps({ allowRequest: vi.fn(() => Promise.resolve(false)) });
    const result = await registerTeam(input, "token", "ip", d);
    expect(result).toMatchObject({ status: "error", message: copy.rateLimited });
    expect(d.verifyHuman).not.toHaveBeenCalled();
    expect(d.saveTeam).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without calling Turnstile", async () => {
    const d = deps();
    const result = await registerTeam({ ...input, teamName: "" }, "token", "ip", d);
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.fieldErrors.has("teamName")).toBe(true);
    expect(d.verifyHuman).not.toHaveBeenCalled();
  });

  it("rejects a missing or failed human check", async () => {
    expect(await registerTeam(input, "", "ip", deps())).toMatchObject({ message: copy.humanCheck });
    const d = deps({ verifyHuman: vi.fn(() => Promise.resolve(false)) });
    expect(await registerTeam(input, "t", "ip", d)).toMatchObject({ message: copy.humanCheck });
    expect(d.saveTeam).not.toHaveBeenCalled();
  });

  it("maps a taken team name to the team name field", async () => {
    const result = await registerTeam(
      input,
      "t",
      "ip",
      deps({}, { ok: false, code: "team_name_taken" }),
    );
    expect(result.status === "error" && result.fieldErrors.get("teamName")).toBe(
      copy.teamNameTaken,
    );
  });

  it("maps a taken email to the member who used it", async () => {
    const result = await registerTeam(
      input,
      "t",
      "ip",
      deps({}, { ok: false, code: "email_taken", detail: "vik@example.com" }),
    );
    expect(result.status === "error" && result.fieldErrors.get("members.1.email")).toMatch(
      /use a different email for member 2/,
    );
  });

  it("explains a full event", async () => {
    const result = await registerTeam(
      input,
      "t",
      "ip",
      deps({}, { ok: false, code: "event_full" }),
    );
    expect(result).toMatchObject({ status: "error", message: copy.eventFull });
  });

  it("never throws: an outage becomes a friendly retry message", async () => {
    const d = deps({ saveTeam: vi.fn(() => Promise.reject(new Error("boom"))) });
    expect(await registerTeam(input, "t", "ip", d)).toMatchObject({ message: copy.unavailable });
    const d2 = deps({ allowRequest: vi.fn(() => Promise.reject(new Error("no redis"))) });
    expect(await registerTeam(input, "t", "ip", d2)).toMatchObject({ message: copy.unavailable });
  });
});
