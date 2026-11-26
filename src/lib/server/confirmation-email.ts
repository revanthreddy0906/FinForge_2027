import "server-only";

/**
 * Confirmation email. Switched off until FinForge has a domain verified with an email provider
 * (Resend needs one to email participants). The on-screen team reference is the proof of
 * registration meanwhile. To switch on: verify a domain, add RESEND_API_KEY and the sender
 * address, install `resend`, and send here. Must never throw.
 */
export async function sendConfirmationEmail(): Promise<void> {
  // TODO: confirmation email (needs a verified sending domain).
  await Promise.resolve();
}
