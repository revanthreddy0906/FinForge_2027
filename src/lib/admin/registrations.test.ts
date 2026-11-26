import { describe, expect, it } from "vitest";
import {
  CSV_HEADER,
  csvCell,
  formatRegisteredAt,
  formatRupees,
  groupTeams,
  matchesPaymentFilter,
  matchesSearch,
  paymentLabel,
  registrationsCsv,
  type RegistrationRow,
} from "./registrations";

const row = (over: Partial<RegistrationRow>): RegistrationRow => ({
  reference: "FF27-0001",
  team_name: "Ledger Hawks",
  institution: "CBIT",
  status: "registered",
  leader_phone: "+919876543210",
  registered_at: "2026-11-26T10:00:00Z",
  position: 1,
  is_leader: true,
  full_name: "Asha Rao",
  email: "asha@example.com",
  payment_state: "paid",
  amount_paise: 139800,
  razorpay_payment_id: "pay_ABC123",
  paid_at: "2026-11-26T10:05:00Z",
  ...over,
});

describe("groupTeams", () => {
  it("groups members under their team, in position order, oldest team first", () => {
    const teams = groupTeams([
      row({ reference: "FF27-0002", team_name: "Firewall", registered_at: "2026-11-27T10:00:00Z" }),
      row({ position: 2, is_leader: false, full_name: "Vik", email: "vik@example.com" }),
      row({}),
    ]);
    expect(teams.map((t) => t.reference)).toEqual(["FF27-0001", "FF27-0002"]);
    expect(teams[0]?.members.map((m) => m.fullName)).toEqual(["Asha Rao", "Vik"]);
    expect(teams[0]?.members[0]?.isLeader).toBe(true);
  });

  it("skips rows without a reference and handles no rows", () => {
    expect(groupTeams([row({ reference: null })])).toEqual([]);
    expect(groupTeams([])).toEqual([]);
  });
});

describe("matchesSearch", () => {
  const [team] = groupTeams([row({}), row({ position: 2, full_name: "Vik", email: "VIK@x.com" })]);
  if (!team) throw new Error("fixture");

  it("matches team, college, reference, member name and email, ignoring case", () => {
    for (const q of ["hawks", "cbit", "ff27-0001", "vik", "vik@x", "  ASHA "]) {
      expect(matchesSearch(team, q)).toBe(true);
    }
  });

  it("returns everything for an empty query and nothing for a miss", () => {
    expect(matchesSearch(team, "")).toBe(true);
    expect(matchesSearch(team, "zebra")).toBe(false);
  });
});

describe("csvCell", () => {
  it("quotes values and doubles quotes", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell(3)).toBe('"3"');
  });

  it("neutralises spreadsheet formulas (CSV injection)", () => {
    for (const bad of ['=HYPERLINK("x")', "+1", "-2+3", "@SUM(A1)", "\tx", "\rx"]) {
      expect(csvCell(bad).startsWith(`"'`)).toBe(true);
    }
    expect(csvCell("+919876543210")).toBe(`"'+919876543210"`);
    expect(csvCell("Normal team")).toBe('"Normal team"');
  });
});

describe("registrationsCsv", () => {
  it("writes a header and one row per member, leader mobile on the leader row only", () => {
    const csv = registrationsCsv(
      groupTeams([
        row({}),
        row({ position: 2, is_leader: false, full_name: "Vik", email: "v@x.com" }),
      ]),
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(CSV_HEADER.map((h) => `"${h}"`).join(","));
    expect(lines[1]).toContain('"Leader","Asha Rao","asha@example.com","\'+919876543210"');
    expect(lines[2]).toContain('"Member","Vik","v@x.com",""');
    expect(lines[1]).toContain('"paid","1398.00","pay_ABC123"');
  });

  it("is just the header when there are no teams", () => {
    expect(registrationsCsv([]).slice(1).trimEnd().split("\r\n")).toHaveLength(1);
  });
});

describe("formatRegisteredAt", () => {
  it("shows India time", () => {
    expect(formatRegisteredAt("2026-11-26T18:05:00Z")).toMatch(/26 Nov 2026.*11:35\s?pm/i);
  });

  it("returns an empty string for a bad date", () => {
    expect(formatRegisteredAt("nope")).toBe("");
  });
});

describe("payments in the console", () => {
  const hold = 30;
  const registeredAt = "2026-11-26T10:00:00Z";
  const at = (minutes: number) => new Date(registeredAt).getTime() + minutes * 60_000;
  const team = (over: Partial<RegistrationRow>) => {
    const [t] = groupTeams([row({ registered_at: registeredAt, ...over })]);
    if (!t) throw new Error("no team");
    return t;
  };

  it("labels paid, waiting, expired and fee-free teams", () => {
    expect(paymentLabel(team({}), hold, at(5))).toBe("Paid");
    const unpaid = team({ payment_state: "pending", razorpay_payment_id: null, paid_at: null });
    expect(paymentLabel(unpaid, hold, at(29))).toBe("Waiting for payment");
    expect(paymentLabel(unpaid, hold, at(31))).toBe("Hold expired");
    expect(paymentLabel(team({ payment_state: "not_required" }), hold, at(5))).toBe("No fee");
  });

  it("filters paid and waiting teams", () => {
    const paid = team({});
    const unpaid = team({ payment_state: "pending" });
    expect(matchesPaymentFilter(paid, "paid")).toBe(true);
    expect(matchesPaymentFilter(paid, "waiting")).toBe(false);
    expect(matchesPaymentFilter(unpaid, "waiting")).toBe(true);
    expect(matchesPaymentFilter(unpaid, "all")).toBe(true);
  });

  it("finds a team by its Razorpay payment ID", () => {
    expect(matchesSearch(team({}), "pay_abc")).toBe(true);
  });

  it("formats rupees from paise", () => {
    expect(formatRupees(139800)).toBe("₹1,398");
    expect(formatRupees(349500)).toBe("₹3,495");
    expect(formatRupees(null)).toBe("");
  });
});
