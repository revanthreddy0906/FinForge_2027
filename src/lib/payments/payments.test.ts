import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { feeBreakdown, formatPaise, teamFeePaise } from "./amount";
import {
  confirmPayment,
  recordTrustedPayment,
  startPayment,
  type ConfirmDeps,
  type MarkResult,
  type PaymentDetails,
  type StartDeps,
} from "./flow";
import {
  paymentEntitySchema,
  verifyRequestSchema,
  webhookSchema,
  type PaymentEntity,
} from "./schema";
import { checkoutSignatureValid, webhookSignatureValid } from "./signature";

const hex = (message: string, secret: string) =>
  createHmac("sha256", secret).update(message).digest("hex");

describe("fees", () => {
  it("charges ₹699 per member, in paise, for teams of 2 to 5", () => {
    expect(teamFeePaise(2)).toBe(139800);
    expect(teamFeePaise(3)).toBe(209700);
    expect(teamFeePaise(5)).toBe(349500);
  });

  it("refuses team sizes the event doesn't allow", () => {
    for (const n of [0, 1, 6, 2.5, Number.NaN]) expect(() => teamFeePaise(n)).toThrow(RangeError);
  });

  it("formats amounts for people", () => {
    expect(formatPaise(209700)).toBe("₹2,097");
    expect(feeBreakdown(3)).toBe("3 × ₹699");
  });
});

describe("signatures", () => {
  const secret = "test_secret";

  it("accepts Razorpay's checkout signature of order_id|payment_id", () => {
    const sig = hex("order_ABC123|pay_XYZ789", secret);
    expect(checkoutSignatureValid("order_ABC123", "pay_XYZ789", sig, secret)).toBe(true);
    expect(checkoutSignatureValid("order_ABC123", "pay_XYZ789", sig.toUpperCase(), secret)).toBe(
      true,
    );
  });

  it("rejects a signature for another payment, another secret, or junk", () => {
    const sig = hex("order_ABC123|pay_XYZ789", secret);
    expect(checkoutSignatureValid("order_ABC123", "pay_OTHER1", sig, secret)).toBe(false);
    expect(checkoutSignatureValid("order_ABC123", "pay_XYZ789", sig, "other")).toBe(false);
    expect(checkoutSignatureValid("order_ABC123", "pay_XYZ789", "abc", secret)).toBe(false);
    expect(checkoutSignatureValid("order_ABC123", "pay_XYZ789", sig, "")).toBe(false);
  });

  it("checks a webhook signature over the exact raw body", () => {
    const body = '{"event":"payment.captured"}';
    const sig = hex(body, "whsec");
    expect(webhookSignatureValid(body, sig, "whsec")).toBe(true);
    expect(webhookSignatureValid(`${body} `, sig, "whsec")).toBe(false);
    expect(webhookSignatureValid(body, sig, "")).toBe(false);
  });
});

describe("schemas", () => {
  it("accepts a checkout result and rejects anything else", () => {
    const ok = {
      razorpay_order_id: "order_ABC123",
      razorpay_payment_id: "pay_XYZ789",
      razorpay_signature: "a".repeat(64),
    };
    expect(verifyRequestSchema.safeParse(ok).success).toBe(true);
    expect(verifyRequestSchema.safeParse({ ...ok, razorpay_order_id: "x' or 1=1" }).success).toBe(
      false,
    );
    expect(verifyRequestSchema.safeParse({ ...ok, razorpay_signature: "zz" }).success).toBe(false);
  });

  it("only accepts INR payment entities", () => {
    const entity = {
      id: "pay_XYZ789",
      order_id: "order_ABC123",
      amount: 139800,
      currency: "INR",
      status: "captured",
    };
    expect(paymentEntitySchema.safeParse(entity).success).toBe(true);
    expect(paymentEntitySchema.safeParse({ ...entity, currency: "USD" }).success).toBe(false);
    expect(paymentEntitySchema.safeParse({ ...entity, amount: -1 }).success).toBe(false);
  });

  it("reads the webhook envelope", () => {
    expect(webhookSchema.safeParse({ event: "payment.captured", payload: {} }).success).toBe(true);
    expect(webhookSchema.safeParse({ nope: true }).success).toBe(false);
  });
});

const details = (over: Partial<PaymentDetails> = {}): PaymentDetails => ({
  team_reference: "FF27-0007",
  team_name: "Ledger Hawks",
  payment_state: "pending",
  leader_name: "Asha Rao",
  leader_email: "asha@example.com",
  leader_phone: "+919876543210",
  member_count: 3,
  amount_paise: 209700,
  razorpay_order_id: null,
  order_amount_paise: null,
  ...over,
});

function startDeps(d: PaymentDetails, over: Partial<StartDeps> = {}) {
  return {
    keyId: () => "rzp_test_abc",
    details: vi.fn(() => Promise.resolve(d)),
    createOrder: vi.fn(() => Promise.resolve({ id: "order_NEW123" })),
    recordOrder: vi.fn((_t: string, id: string) => Promise.resolve(id)),
    log: vi.fn(),
    ...over,
  } satisfies StartDeps;
}

describe("startPayment", () => {
  it("creates an order for the server-computed amount and returns what checkout needs", async () => {
    const deps = startDeps(details());
    const out = await startPayment("team-1", deps);
    expect(deps.createOrder).toHaveBeenCalledWith({
      amountPaise: 209700,
      receipt: "FF27-0007",
      notes: { team_reference: "FF27-0007" },
    });
    expect(deps.recordOrder).toHaveBeenCalledWith("team-1", "order_NEW123", 209700);
    expect(out).toEqual({
      kind: "pay",
      payment: {
        keyId: "rzp_test_abc",
        orderId: "order_NEW123",
        amountPaise: 209700,
        memberCount: 3,
        reference: "FF27-0007",
        teamName: "Ledger Hawks",
        prefill: { name: "Asha Rao", email: "asha@example.com", contact: "+919876543210" },
      },
    });
  });

  it("reuses the team's existing order instead of making a second one", async () => {
    const deps = startDeps(
      details({ razorpay_order_id: "order_OLD123", order_amount_paise: 209700 }),
    );
    const out = await startPayment("team-1", deps);
    expect(deps.createOrder).not.toHaveBeenCalled();
    expect(out.kind === "pay" && out.payment.orderId).toBe("order_OLD123");
  });

  it("uses the stored order when two requests race", async () => {
    const deps = startDeps(details(), {
      recordOrder: vi.fn(() => Promise.resolve("order_FIRST1")),
    });
    const out = await startPayment("team-1", deps);
    expect(out.kind === "pay" && out.payment.orderId).toBe("order_FIRST1");
  });

  it("won't reuse an order for an old amount", async () => {
    const deps = startDeps(details({ razorpay_order_id: "order_OLD123", order_amount_paise: 100 }));
    expect(await startPayment("team-1", deps)).toEqual({ kind: "unavailable" });
  });

  it("reports a paid team as paid", async () => {
    const deps = startDeps(details({ payment_state: "paid" }));
    expect(await startPayment("team-1", deps)).toEqual({
      kind: "paid",
      reference: "FF27-0007",
      teamName: "Ledger Hawks",
    });
    expect(deps.createOrder).not.toHaveBeenCalled();
  });

  it("never throws when Razorpay or the database fails", async () => {
    const deps = startDeps(details(), {
      createOrder: vi.fn(() => Promise.reject(new Error("razorpay down"))),
    });
    expect(await startPayment("team-1", deps)).toEqual({ kind: "unavailable" });
  });
});

const captured: PaymentEntity = {
  id: "pay_XYZ789",
  order_id: "order_ABC123",
  amount: 209700,
  currency: "INR",
  status: "captured",
};

function confirmDeps(mark: MarkResult, payment: PaymentEntity = captured) {
  return {
    fetchPayment: vi.fn(() => Promise.resolve(payment)),
    capturePayment: vi.fn(() => Promise.resolve({ ...payment, status: "captured" as const })),
    markPaid: vi.fn(() => Promise.resolve(mark)),
    sendConfirmation: vi.fn(() => Promise.resolve()),
    log: vi.fn(),
  } satisfies ConfirmDeps;
}

const paid = (outcome: "paid" | "already_paid" | "orphan" | "other_payment"): MarkResult => ({
  ok: true,
  outcome,
  reference: "FF27-0007",
  teamName: "Ledger Hawks",
  leaderEmail: "asha@example.com",
});

describe("confirmPayment", () => {
  it("records a captured payment with Razorpay's amount and emails the leader once", async () => {
    const deps = confirmDeps(paid("paid"));
    expect(await confirmPayment("order_ABC123", "pay_XYZ789", deps)).toEqual({
      status: "paid",
      reference: "FF27-0007",
      teamName: "Ledger Hawks",
    });
    expect(deps.markPaid).toHaveBeenCalledWith("order_ABC123", "pay_XYZ789", 209700);
    expect(deps.sendConfirmation).toHaveBeenCalledTimes(1);
  });

  it("treats a repeat (webhook after the pop-up) as paid without a second email", async () => {
    const deps = confirmDeps(paid("already_paid"));
    expect((await confirmPayment("order_ABC123", "pay_XYZ789", deps)).status).toBe("paid");
    expect(deps.sendConfirmation).not.toHaveBeenCalled();
  });

  it("captures an authorized payment first", async () => {
    const deps = confirmDeps(paid("paid"), { ...captured, status: "authorized" });
    await confirmPayment("order_ABC123", "pay_XYZ789", deps);
    expect(deps.capturePayment).toHaveBeenCalledWith("pay_XYZ789", 209700);
  });

  it("flags late payments and second payments for a refund", async () => {
    for (const outcome of ["orphan", "other_payment"] as const) {
      const deps = confirmDeps(paid(outcome));
      expect(await confirmPayment("order_ABC123", "pay_XYZ789", deps)).toEqual({
        status: "refund_needed",
        reference: "FF27-0007",
      });
      expect(deps.sendConfirmation).not.toHaveBeenCalled();
    }
  });

  it("refuses a payment that belongs to another order", async () => {
    const deps = confirmDeps(paid("paid"), { ...captured, order_id: "order_OTHER1" });
    expect(await confirmPayment("order_ABC123", "pay_XYZ789", deps)).toEqual({ status: "error" });
    expect(deps.markPaid).not.toHaveBeenCalled();
  });

  it("doesn't mark failed or unfinished payments", async () => {
    const deps = confirmDeps(paid("paid"), { ...captured, status: "failed" });
    expect(await confirmPayment("order_ABC123", "pay_XYZ789", deps)).toEqual({
      status: "not_paid",
    });
    expect(deps.markPaid).not.toHaveBeenCalled();
  });

  it("passes on database rejections and never throws", async () => {
    const rejected = confirmDeps({ ok: false, code: "amount_mismatch" });
    expect(await confirmPayment("order_ABC123", "pay_XYZ789", rejected)).toEqual({
      status: "rejected",
      code: "amount_mismatch",
    });
    const down = confirmDeps({ ok: false, code: "unavailable" });
    expect(await recordTrustedPayment(captured, down)).toEqual({ status: "error" });
    const boom = confirmDeps(paid("paid"));
    boom.fetchPayment.mockRejectedValueOnce(new Error("network"));
    expect(await confirmPayment("order_ABC123", "pay_XYZ789", boom)).toEqual({ status: "error" });
  });
});
