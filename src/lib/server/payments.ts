import "server-only";
import { feePerMemberPaise } from "@/lib/payments/amount";
import type { ConfirmDeps, MarkResult, PaymentDetails, StartDeps } from "@/lib/payments/flow";
import { sendConfirmationEmail } from "./confirmation-email";
import { capturePayment, createOrder, fetchPayment } from "./razorpay";
import { razorpayEnv } from "./razorpay-env";
import { supabaseAdmin } from "./supabase-admin";

const log = (message: string, data?: Record<string, unknown>) => {
  console.error(message, data ?? {});
};

async function details(teamId: string): Promise<PaymentDetails> {
  const { data, error } = await supabaseAdmin().rpc("payment_details", {
    p_team_id: teamId,
    p_fee_per_member_paise: feePerMemberPaise,
  });
  if (error) throw new Error(`payment_details failed: ${error.code}`);
  const row = data[0];
  if (!row) throw new Error("payment_details returned nothing");
  // The generated types mark the order columns non-null; they are null until an order exists,
  // which PaymentDetails says.
  return row;
}

async function recordOrder(teamId: string, orderId: string, amountPaise: number): Promise<string> {
  const { data, error } = await supabaseAdmin().rpc("record_payment_order", {
    p_team_id: teamId,
    p_razorpay_order_id: orderId,
    p_amount_paise: amountPaise,
  });
  if (error) throw new Error(`record_payment_order failed: ${error.code} ${error.message}`);
  return data;
}

const markCodes = new Set(["unknown_order", "amount_mismatch"]);
const outcomes = new Set(["paid", "already_paid", "orphan", "other_payment"]);

async function markPaid(
  orderId: string,
  paymentId: string,
  amountPaise: number,
): Promise<MarkResult> {
  const { data, error } = await supabaseAdmin().rpc("mark_order_paid", {
    p_razorpay_order_id: orderId,
    p_razorpay_payment_id: paymentId,
    p_amount_paise: amountPaise,
  });
  if (error) {
    if (error.code === "P0001" && markCodes.has(error.message)) {
      return { ok: false, code: error.message as "unknown_order" | "amount_mismatch" };
    }
    log("[payments] mark_order_paid failed", { code: error.code });
    return { ok: false, code: "unavailable" };
  }
  const row = data[0];
  if (!row || !outcomes.has(row.outcome)) return { ok: false, code: "unavailable" };
  return {
    ok: true,
    outcome: row.outcome as "paid" | "already_paid" | "orphan" | "other_payment",
    reference: row.team_reference,
    teamName: row.team_name,
    leaderEmail: row.leader_email,
  };
}

export const startDeps: StartDeps = {
  keyId: () => razorpayEnv().RAZORPAY_KEY_ID,
  details,
  createOrder,
  recordOrder,
  log,
};

export const confirmDeps: ConfirmDeps = {
  fetchPayment,
  capturePayment,
  markPaid,
  sendConfirmation: sendConfirmationEmail,
  log,
};
