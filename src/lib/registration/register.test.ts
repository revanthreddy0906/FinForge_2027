import { describe, expect, it, vi } from "vitest";
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

function deps(overrides: Partial<RegisterDeps> = {}, save?: SaveOutcome) {
  return {
    registrationState: () => "open" as const,
    allowRequest: vi.fn(() => Promise.resolve(true)),
    verifyHuman: vi.fn(() => Promise.resolve(true)),
    saveTeam: vi.fn(() =>
      Promise.resolve<SaveOutcome>(save ?? { ok: true, reference: "FF27-0007", created: true }),
    ),
    sendConfirmation: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies RegisterDeps;
}

describe("registerTeam", () => {
  it("saves a valid team and returns its reference", async () => {
    const d = deps();
    const result = await registerTeam(input, "token", "1.2.3.4", d);
    expect(result).toEqual({ status: "success", reference: "FF27-0007", teamName: "Ledger Hawks" });
    expect(d.verifyHuman).toHaveBeenCalledWith("token", "1.2.3.4");
    expect(d.saveTeam).toHaveBeenCalledWith(
      expect.objectContaining({ leader_phone: "+919876543210", team_name: "Ledger Hawks" }),
    );
    expect(d.sendConfirmation).toHaveBeenCalledWith(
      "asha@example.com",
      "FF27-0007",
      "Ledger Hawks",
    );
  });

  it("returns the same team on a replay and doesn't email twice", async () => {
    const d = deps({}, { ok: true, reference: "FF27-0007", created: false });
    const result = await registerTeam(input, "token", "ip", d);
    expect(result.status).toBe("success");
    expect(d.sendConfirmation).not.toHaveBeenCalled();
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
