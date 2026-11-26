/** What the payment step shows. Plain words only; the browser never sees internals. */
export const verifyCopy = {
  rateLimited: "Too many attempts from your network. Wait a minute, then press Check payment.",
  invalid:
    "We couldn't confirm this payment. If money left your account, contact us with your team reference and we'll sort it out.",
  notPaid:
    "Razorpay hasn't confirmed this payment yet. If money left your account, wait a minute and press Check payment.",
  refund:
    "Your payment arrived after your registration's hold expired, so we couldn't keep the team. We'll refund it in full. Contact us with this reference if you have questions.",
  error:
    "We couldn't confirm your payment just now. If money left your account, it's safe: press Check payment in a minute.",
} as const;

export type VerifyResponse =
  | { status: "paid"; reference: string; teamName: string }
  | { status: "error"; message: string; retry: boolean };

/** Messages on the payment step itself. */
export const payCopy = {
  scriptFailed:
    "The payment window couldn't load. Check your connection and press Pay again. Your team is held for a few minutes.",
  dismissed:
    "Payment cancelled. Your team is saved and held for a few minutes, so you can pay now.",
  failed:
    "The payment didn't go through and no money was taken. Try again, or use another payment method.",
} as const;
