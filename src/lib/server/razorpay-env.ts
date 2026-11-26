import "server-only";
import { z } from "zod";

const schema = z.object({
  RAZORPAY_KEY_ID: z.string().regex(/^rzp_(test|live)_[A-Za-z0-9]{6,32}$/),
  RAZORPAY_KEY_SECRET: z.string().min(16),
  /** Optional until the webhook is set up in the Razorpay dashboard. */
  RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
  /** Only for the end-to-end tests, which point this at a local stand-in. */
  RAZORPAY_API_BASE: z.url().optional(),
});

export type RazorpayEnv = z.infer<typeof schema>;

const optional = (v: string | undefined) => (v === "" ? undefined : v);

let cached: RazorpayEnv | undefined;

/**
 * Razorpay settings. Throws when the keys are missing, and the caller shows "try again", so a
 * deploy without keys never takes a registration it can't charge for. Separate from serverEnv
 * so pages that don't take payments keep working without Razorpay keys.
 */
export function razorpayEnv(): RazorpayEnv {
  cached ??= schema.parse({
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: optional(process.env.RAZORPAY_WEBHOOK_SECRET),
    // Never honoured on Vercel, so a stray setting can't send payment checks somewhere else.
    RAZORPAY_API_BASE: process.env.VERCEL ? undefined : optional(process.env.RAZORPAY_API_BASE),
  });
  return cached;
}
