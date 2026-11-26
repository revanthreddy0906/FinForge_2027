import type { PaymentEntity } from "./schema";

/** What the browser needs to open the Razorpay pop-up. Nothing secret. */
export interface PaymentStart {
  keyId: string;
  orderId: string;
  amountPaise: number;
  memberCount: number;
  reference: string;
  teamName: string;
  prefill: { name: string; email: string; contact: string };
}

export type StartOutcome =
  | { kind: "pay"; payment: PaymentStart }
  | { kind: "paid"; reference: string; teamName: string }
  | { kind: "unavailable" };

/** One row of public.payment_details. */
export interface PaymentDetails {
  team_reference: string;
  team_name: string;
  payment_state: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  member_count: number;
  amount_paise: number;
  razorpay_order_id: string | null;
  order_amount_paise: number | null;
}

export interface StartDeps {
  keyId: () => string;
  details: (teamId: string) => Promise<PaymentDetails>;
  createOrder: (input: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }) => Promise<{ id: string }>;
  /** Returns the order that is stored for the team (the first one if two requests raced). */
  recordOrder: (teamId: string, orderId: string, amountPaise: number) => Promise<string>;
  log: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Starts or resumes payment for a team. Reuses the team's order, so a retry, a double click or a
 * second tab never creates a second charge for the same team. Never throws.
 */
export async function startPayment(teamId: string, deps: StartDeps): Promise<StartOutcome> {
  try {
    const d = await deps.details(teamId);
    if (d.payment_state !== "pending") {
      return { kind: "paid", reference: d.team_reference, teamName: d.team_name };
    }
    let orderId = d.razorpay_order_id;
    if (orderId && d.order_amount_paise !== d.amount_paise) {
      // The fee changed after this order was made. Charging the old amount would be wrong.
      deps.log("[payments] stored order amount differs from the current fee", {
        reference: d.team_reference,
      });
      return { kind: "unavailable" };
    }
    if (!orderId) {
      const order = await deps.createOrder({
        amountPaise: d.amount_paise,
        receipt: d.team_reference,
        notes: { team_reference: d.team_reference },
      });
      orderId = await deps.recordOrder(teamId, order.id, d.amount_paise);
    }
    return {
      kind: "pay",
      payment: {
        keyId: deps.keyId(),
        orderId,
        amountPaise: d.amount_paise,
        memberCount: d.member_count,
        reference: d.team_reference,
        teamName: d.team_name,
        prefill: { name: d.leader_name, email: d.leader_email, contact: d.leader_phone },
      },
    };
  } catch (e) {
    deps.log("[payments] could not start payment", {
      error: e instanceof Error ? e.message : "unknown",
    });
    return { kind: "unavailable" };
  }
}

export type MarkOutcome = "paid" | "already_paid" | "orphan" | "other_payment";

export type MarkResult =
  | {
      ok: true;
      outcome: MarkOutcome;
      reference: string;
      teamName: string;
      leaderEmail: string | null;
    }
  | { ok: false; code: "unknown_order" | "amount_mismatch" | "unavailable" };

export interface ConfirmDeps {
  fetchPayment: (paymentId: string) => Promise<PaymentEntity>;
  capturePayment: (paymentId: string, amountPaise: number) => Promise<PaymentEntity>;
  markPaid: (orderId: string, paymentId: string, amountPaise: number) => Promise<MarkResult>;
  sendConfirmation: (to: string, reference: string, teamName: string) => Promise<void>;
  log: (message: string, data?: Record<string, unknown>) => void;
}

export type ConfirmResult =
  | { status: "paid"; reference: string; teamName: string }
  | { status: "refund_needed"; reference: string }
  | { status: "not_paid" }
  /** Not one of our orders (another Razorpay product on the same account) or a wrong amount. */
  | { status: "rejected"; code: "unknown_order" | "amount_mismatch" }
  | { status: "error" };

/** Records a payment we trust (fetched from Razorpay, or from a signed webhook). */
export async function recordTrustedPayment(
  payment: PaymentEntity,
  deps: Pick<ConfirmDeps, "markPaid" | "sendConfirmation" | "log">,
): Promise<ConfirmResult> {
  if (payment.status !== "captured") return { status: "not_paid" };
  const marked = await deps.markPaid(payment.order_id, payment.id, payment.amount);
  if (!marked.ok) {
    deps.log("[payments] could not mark order paid", {
      code: marked.code,
      order: payment.order_id,
    });
    return marked.code === "unavailable"
      ? { status: "error" }
      : { status: "rejected", code: marked.code };
  }
  switch (marked.outcome) {
    case "paid":
      if (marked.leaderEmail) {
        await deps.sendConfirmation(marked.leaderEmail, marked.reference, marked.teamName);
      }
      return { status: "paid", reference: marked.reference, teamName: marked.teamName };
    case "already_paid":
      return { status: "paid", reference: marked.reference, teamName: marked.teamName };
    case "orphan":
    case "other_payment":
      deps.log("[payments] payment needs a refund", {
        outcome: marked.outcome,
        reference: marked.reference,
        payment: payment.id,
      });
      return { status: "refund_needed", reference: marked.reference };
  }
}

/**
 * After the pop-up reports success and its signature checks out: fetch the payment from Razorpay
 * (the browser can't be trusted on amount or status), capture it if needed, then record it.
 */
export async function confirmPayment(
  orderId: string,
  paymentId: string,
  deps: ConfirmDeps,
): Promise<ConfirmResult> {
  try {
    let payment = await deps.fetchPayment(paymentId);
    if (payment.order_id !== orderId) {
      deps.log("[payments] payment belongs to a different order", { order: orderId });
      return { status: "error" };
    }
    if (payment.status === "authorized")
      payment = await deps.capturePayment(payment.id, payment.amount);
    return await recordTrustedPayment(payment, deps);
  } catch (e) {
    deps.log("[payments] confirm failed", { error: e instanceof Error ? e.message : "unknown" });
    return { status: "error" };
  }
}
