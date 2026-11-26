import { z } from "zod";

export const orderId = z.string().regex(/^order_[A-Za-z0-9]{6,40}$/, "invalid order id");
export const paymentId = z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/, "invalid payment id");

/** What the browser sends after the Razorpay pop-up reports success. */
export const verifyRequestSchema = z.object({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: z.string().regex(/^[0-9a-fA-F]{64}$/, "invalid signature"),
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

/** The parts of a Razorpay payment entity we rely on (API response and webhook payload). */
export const paymentEntitySchema = z.object({
  id: paymentId,
  order_id: orderId,
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
});
export type PaymentEntity = z.infer<typeof paymentEntitySchema>;

/** Webhook events we act on. Everything else is acknowledged and ignored. */
export const webhookSchema = z.object({
  event: z.string().max(64),
  payload: z.object({ payment: z.object({ entity: z.unknown() }).optional() }).optional(),
});
