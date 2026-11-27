import { describe, expect, it, vi } from "vitest";
import {
  normaliseCode,
  normaliseReference,
  selectionFormData,
  selectionSchema,
  copy,
} from "./schema";
import { submitCopy, submitSelection, type SaveChoiceOutcome, type SubmitDeps } from "./submit";

const valid = { reference: "FF27-0080", code: "K7MQ2XRT", ranking: [3, 1, 4, 2] };

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

  it.each([
    ["k7mq2xrt", "K7MQ2XRT"],
    ["K7MQ-2XRT", "K7MQ2XRT"],
    [" k7mq 2xrt ", "K7MQ2XRT"],
  ])("code %j becomes %j", (raw, want) => {
    expect(normaliseCode(raw)).toBe(want);
  });
});

describe("selectionSchema", () => {
  it("accepts a reference, a code and a full ranking", () => {
    const parsed = selectionSchema.parse({ ...valid, reference: "ff27-80", code: "k7mq-2xrt" });
    expect(parsed).toEqual(valid);
  });

  it.each([
    [{ ...valid, reference: "" }, "reference", copy.referenceRequired],
    [{ ...valid, reference: "FF26-0001" }, "reference", copy.referenceFormat],
    [{ ...valid, code: "" }, "code", copy.codeRequired],
    [{ ...valid, code: "K7MQ2XR0" }, "code", copy.codeFormat],
    [{ ...valid, code: "K7MQ2XRTT" }, "code", copy.codeFormat],
    [{ ...valid, code: "I7MQ2XRT" }, "code", copy.codeFormat],
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
    expect(selectionSchema.safeParse({ ...valid, code: "A".repeat(41) }).success).toBe(false);
  });
});

describe("selectionFormData", () => {
  it("reads the ranking as numbers in order", () => {
    const fd = new FormData();
    fd.set("reference", "FF27-0080");
    fd.set("code", "K7MQ2XRT");
    fd.set("ranking", "3,1,4,2");
    expect(selectionFormData(fd)).toEqual(valid);
  });

  it("leaves missing fields undefined", () => {
    expect(selectionFormData(new FormData())).toEqual({
      reference: undefined,
      code: undefined,
      ranking: undefined,
    });
  });
});

function deps(outcome: SaveChoiceOutcome, overrides: Partial<SubmitDeps> = {}) {
  return {
    allowNetwork: vi.fn(() => Promise.resolve(true)),
    allowReference: vi.fn((reference: string) => Promise.resolve(reference.length > 0)),
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
    expect(d.allowReference).toHaveBeenCalledWith("FF27-0080");
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
    const result = await submitSelection({ ...valid, code: "nope" }, d);
    expect(result).toMatchObject({ status: "error", fieldErrors: { code: copy.codeFormat } });
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

  it("stops at the per-reference limit", async () => {
    const d = deps(
      { ok: true, outcome: "submitted", submittedAt: "x" },
      { allowReference: () => Promise.resolve(false) },
    );
    expect(await submitSelection(valid, d)).toMatchObject({ message: submitCopy.referenceLimited });
    expect(d.saveChoice).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_proof", submitCopy.invalidProof],
    ["selection_not_open", submitCopy.notOpen],
    ["selection_closed", submitCopy.closed],
    ["not_eligible", submitCopy.notEligible],
    ["unavailable", submitCopy.unavailable],
    ["invalid_ranking", submitCopy.invalid],
  ] as const)("maps %s to a friendly message", async (code, message) => {
    const result = await submitSelection(valid, deps({ ok: false, code }));
    expect(result).toMatchObject({ status: "error", message });
  });

  it("marks both fields when the reference and code don't match", async () => {
    const result = await submitSelection(valid, deps({ ok: false, code: "invalid_proof" }));
    expect(result).toMatchObject({
      fieldErrors: { reference: submitCopy.invalidProof, code: submitCopy.invalidProof },
    });
  });

  it("turns a thrown error (for example no rate limiter) into a retry message", async () => {
    const d = deps(
      { ok: true, outcome: "submitted", submittedAt: "x" },
      { allowNetwork: () => Promise.reject(new Error("Upstash rate limiting is not configured")) },
    );
    expect(await submitSelection(valid, d)).toMatchObject({ message: submitCopy.unavailable });
  });
});
