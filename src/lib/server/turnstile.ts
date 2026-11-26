import "server-only";
import { z } from "zod";
import { serverEnv } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const responseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
  hostname: z.string().optional(),
});

/**
 * Verifies a Cloudflare Turnstile token on the server. Network or parse errors count as failure.
 * Failures are logged with Cloudflare's error codes only (no token, no IP), so a wrong secret key
 * (`invalid-input-secret`) can be told apart from a bad or reused token in the Vercel logs.
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const body = new URLSearchParams({ secret: serverEnv().TURNSTILE_SECRET_KEY, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[turnstile] siteverify answered HTTP ${String(res.status)}`);
      return false;
    }
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.warn("[turnstile] siteverify answer did not match the expected shape");
      return false;
    }
    if (!parsed.data.success) {
      const codes = parsed.data["error-codes"]?.join(",") ?? "none";
      console.warn(`[turnstile] verification failed: ${codes}`);
    }
    return parsed.data.success;
  } catch (error) {
    console.warn(
      `[turnstile] siteverify request failed: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return false;
  }
}
