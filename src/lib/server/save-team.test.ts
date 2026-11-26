import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./supabase-admin", () => ({ supabaseAdmin: () => ({ rpc }) }));

const { saveTeam } = await import("./save-team");

const payload = {
  idempotency_key: "k",
  team_name: "Hawks",
  institution: "CBIT",
  leader_phone: "+919876543210",
  consent_version: "v1",
  members: [],
};

describe("saveTeam", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("returns the reference from register_team", async () => {
    rpc.mockResolvedValue({
      data: [{ team_id: "t", reference: "FF27-0001", created: true }],
      error: null,
    });
    expect(await saveTeam(payload)).toEqual({ ok: true, reference: "FF27-0001", created: true });
    expect(rpc).toHaveBeenCalledWith("register_team", { payload });
  });

  it("passes through known database rule codes with their detail", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "email_taken", details: "a@x.com" },
    });
    expect(await saveTeam(payload)).toEqual({ ok: false, code: "email_taken", detail: "a@x.com" });
  });

  it("treats anything else as unavailable without logging personal data", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied", details: "" },
    });
    expect(await saveTeam(payload)).toEqual({ ok: false, code: "unavailable" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("Hawks");
    log.mockRestore();
  });
});
