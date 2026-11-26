import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 as lowercase hex, which is how Razorpay sends its signatures. */
function hmacHex(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/** Constant-time compare of two hex strings, so the check doesn't leak how much matched. */
function sameHex(expected: string, received: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/**
 * Checkout result check: Razorpay signs `order_id|payment_id` with the key secret.
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 */
export function checkoutSignatureValid(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  if (!keySecret) return false;
  return sameHex(hmacHex(`${orderId}|${paymentId}`, keySecret), signature.toLowerCase());
}

/** Webhook check: Razorpay signs the raw request body with the webhook secret. */
export function webhookSignatureValid(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  if (!webhookSecret) return false;
  return sameHex(hmacHex(rawBody, webhookSecret), signature.toLowerCase());
}

/** For tests and the local Razorpay stand-in only. */
export const signForTests = hmacHex;
