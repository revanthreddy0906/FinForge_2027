import { describe, expect, it, vi } from "vitest";
import { normaliseReference, selectionFormData, selectionSchema, copy } from "./schema";
import { submitCopy, submitSelection, type SaveChoiceOutcome, type SubmitDeps } from "./submit";

const valid = { reference: "FF27-0080", ranking: [3, 1, 4, 2] };

describe("normalising what people type", () => {
  it.each([
    ["FF27-0080", "FF27-0080"],
    ["ff27-0080", "FF27-0080"],
    [" ff27 0080 ", "FF27-0080"],
    ["FF27-80", "FF27-0080"],
    ["FF2780", "FF27-0080"],
    ["XX-1", "XX-1"],
  ])("reference %j becomes %j", (raw, want) => {
    expect(normaliseReference(raw)).toBe(want);
  });
});

describe("selectionSchema", () => {
  it("accepts a reference and a full ranking", () => {
    const parsed = selectionSchema.parse({ ...valid, reference: "ff27-80" });
    expect(parsed).toEqual(valid);
  });

  it.each([
    [{ ...valid, reference: "" }, "reference", copy.referenceRequired],
    [{ ...valid, reference: "FF26-0001" }, "reference", copy.referenceFormat],
    [{ ...valid, ranking: [1, 2, 3] }, "ranking", copy.rankingInvalid],
    [{ ...valid, ranking: [1, 1, 2, 3] }, "ranking", copy.rankingInvalid],
    [{ ...valid, ranking: [1, 2, 3, 5] }, "ranking", copy.rankingInvalid],
    [{ ...valid, ranking: [1, 2, 3, 4.5] }, "ranking", copy.rankingInvalid],
    [{ ...valid, ranking: undefined }, "ranking", copy.rankingInvalid],
  ])("rejects %j on %s", (input, field, message) => {
    const result = selectionSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.find((i) => i.path[0] === field)?.message).toBe(message);
  });

  it("caps very long input before normalising", () => {
    expect(selectionSchema.safeParse({ ...valid, reference: "F".repeat(41) }).success).toBe(false);
  });
});

describe("selectionFormData", () => {
  it("reads the ranking as numbers in order", () => {
    const fd = new FormData();
    fd.set("reference", "FF27-0080");
    fd.set("ranking", "3,1,4,2");
    expect(selectionFormData(fd)).toEqual(valid);
  });

  it("leaves missing fields undefined", () => {
    expect(selectionFormData(new FormData())).toEqual({
      reference: undefined,
      ranking: undefined,
    });
  });
});

function deps(outcome: SaveChoiceOutcome, overrides: Partial<SubmitDeps> = {}) {
  return {
    allowNetwork: vi.fn(() => Promise.resolve(true)),
    saveChoice: vi.fn(() => Promise.resolve(outcome)),
    ...overrides,
  };
}

describe("submitSelection", () => {
  it("saves once and reports the time", async () => {
    const d = deps({ ok: true, outcome: "submitted", submittedAt: "2027-03-10T04:32:13.120Z" });
    const result = await submitSelection(valid, d);
    expect(result).toEqual({
      status: "submitted",
      reference: "FF27-0080",
      submittedAt: "2027-03-10T04:32:13.120Z",
    });
    expect(d.saveChoice).toHaveBeenCalledWith(valid);
  });

  it("reports an existing entry with its original time", async () => {
    const d = deps({ ok: true, outcome: "already_submitted", submittedAt: "2027-03-10T04:30:00Z" });
    expect(await submitSelection(valid, d)).toEqual({
      status: "already-submitted",
      reference: "FF27-0080",
      submittedAt: "2027-03-10T04:30:00Z",
    });
  });

  it("reports an entry an organizer made, which has no time", async () => {
    const d = deps({ ok: true, outcome: "already_submitted", submittedAt: null });
    expect(await submitSelection(valid, d)).toMatchObject({
      status: "already-submitted",
      submittedAt: null,
    });
  });

  it("never calls the database for invalid input", async () => {
    const d = deps({ ok: true, outcome: "submitted", submittedAt: "x" });
    const result = await submitSelection({ ...valid, reference: "nope" }, d);
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { reference: copy.referenceFormat },
    });
    expect(d.allowNetwork).not.toHaveBeenCalled();
    expect(d.saveChoice).not.toHaveBeenCalled();
  });

  it("stops at the network limit", async () => {
    const d = deps(
      { ok: true, outcome: "submitted", submittedAt: "x" },
      { allowNetwork: () => Promise.resolve(false) },
    );
    expect(await submitSelection(valid, d)).toMatchObject({ message: submitCopy.networkLimited });
    expect(d.saveChoice).not.toHaveBeenCalled();
  });

  it.each([
    ["team_not_found", submitCopy.teamNotFound],
    ["selection_not_open", submitCopy.notOpen],
    ["selection_closed", submitCopy.closed],
    ["not_eligible", submitCopy.notEligible],
    ["unavailable", submitCopy.unavailable],
    ["invalid_ranking", submitCopy.invalid],
  ] as const)("maps %s to a friendly message", async (code, message) => {
    const result = await submitSelection(valid, deps({ ok: false, code }));
    expect(result).toMatchObject({ status: "error", message });
  });

  it("marks the reference field when no team has that reference", async () => {
    const result = await submitSelection(valid, deps({ ok: false, code: "team_not_found" }));
    expect(result).toMatchObject({ fieldErrors: { reference: submitCopy.teamNotFound } });
  });

  it("turns a thrown error (for example no rate limiter) into a retry message", async () => {
    const d = deps(
      { ok: true, outcome: "submitted", submittedAt: "x" },
      { allowNetwork: () => Promise.reject(new Error("Upstash rate limiting is not configured")) },
    );
    expect(await submitSelection(valid, d)).toMatchObject({ message: submitCopy.unavailable });
  });
});
