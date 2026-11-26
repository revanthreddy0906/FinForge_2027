import { NextResponse } from "next/server";
import { verifyCopy, type VerifyResponse } from "@/lib/payments/copy";
import { confirmPayment } from "@/lib/payments/flow";
import { verifyRequestSchema } from "@/lib/payments/schema";
import { checkoutSignatureValid } from "@/lib/payments/signature";
import { clientIp } from "@/lib/server/client-ip";
import { confirmDeps } from "@/lib/server/payments";
import { allowRequest } from "@/lib/server/rate-limit";
import { razorpayEnv } from "@/lib/server/razorpay-env";

const json = (body: VerifyResponse, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Called by the payment step after the Razorpay pop-up reports success. Checks Razorpay's
 * signature, then fetches the payment from Razorpay before marking the team paid.
 */
export async function POST(request: Request) {
  const ip = await clientIp();
  try {
    if (!(await allowRequest("payment-verify", ip))) {
      return json({ status: "error", message: verifyCopy.rateLimited, retry: true }, 429);
    }
  } catch {
    return json({ status: "error", message: verifyCopy.error, retry: true }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = verifyRequestSchema.safeParse(body);
  if (!parsed.success)
    return json({ status: "error", message: verifyCopy.invalid, retry: false }, 400);
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = parsed.data;

  let secret: string;
  try {
    secret = razorpayEnv().RAZORPAY_KEY_SECRET;
  } catch {
    console.error("[payments] Razorpay keys are not configured");
    return json({ status: "error", message: verifyCopy.error, retry: true }, 503);
  }
  if (!checkoutSignatureValid(orderId, paymentId, signature, secret)) {
    console.error("[payments] checkout signature mismatch", { order: orderId });
    return json({ status: "error", message: verifyCopy.invalid, retry: false }, 400);
  }

  const result = await confirmPayment(orderId, paymentId, confirmDeps);
  switch (result.status) {
    case "paid":
      return json({ status: "paid", reference: result.reference, teamName: result.teamName });
    case "refund_needed":
      return json(
        {
          status: "error",
          message: `${verifyCopy.refund} Reference: ${result.reference}.`,
          retry: false,
        },
        409,
      );
    case "rejected":
      return json({ status: "error", message: verifyCopy.invalid, retry: false }, 409);
    case "not_paid":
      return json({ status: "error", message: verifyCopy.notPaid, retry: true }, 202);
    case "error":
      return json({ status: "error", message: verifyCopy.error, retry: true }, 502);
  }
}
