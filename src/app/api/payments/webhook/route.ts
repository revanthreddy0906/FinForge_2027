import { NextResponse } from "next/server";
import { recordTrustedPayment } from "@/lib/payments/flow";
import { paymentEntitySchema, webhookSchema } from "@/lib/payments/schema";
import { webhookSignatureValid } from "@/lib/payments/signature";
import { confirmDeps } from "@/lib/server/payments";
import { razorpayEnv } from "@/lib/server/razorpay-env";

/** Events that mean money was captured. Both carry the payment entity. */
const handled = new Set(["payment.captured", "order.paid"]);

/** Bodies are small JSON; anything bigger is not from Razorpay. */
const MAX_BODY = 64 * 1024;

const reply = (status: number, text: string) =>
  new NextResponse(text, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });

/**
 * Razorpay webhook. Catches payments the browser never reported (closed tab, lost network).
 * Trust comes only from the signature over the raw body, so there is no Turnstile or per-IP
 * limit here. Replies 2xx for anything handled or ignored, so Razorpay doesn't retry forever, and
 * 5xx when our database is down, so it does retry.
 */
export async function POST(request: Request) {
  let secret: string | undefined;
  try {
    secret = razorpayEnv().RAZORPAY_WEBHOOK_SECRET;
  } catch {
    secret = undefined;
  }
  if (!secret) {
    console.error("[payments] webhook secret is not configured");
    return reply(503, "not configured");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return reply(413, "too large");
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!webhookSignatureValid(raw, signature, secret)) {
    console.error("[payments] webhook signature mismatch");
    return reply(400, "bad signature");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, "bad body");
  }
  const event = webhookSchema.safeParse(body);
  if (!event.success || !handled.has(event.data.event)) return reply(200, "ignored");
  const payment = paymentEntitySchema.safeParse(event.data.payload?.payment?.entity);
  if (!payment.success) return reply(200, "ignored");

  const result = await recordTrustedPayment(payment.data, confirmDeps);
  if (result.status === "error") return reply(500, "retry");
  return reply(200, "ok");
}
