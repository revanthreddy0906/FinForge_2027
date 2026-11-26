import "server-only";
import { z } from "zod";
import { parseHostnames, rejectReason } from "@/lib/registration/turnstile-check";
import { serverEnv } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
const responseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
  action: z.string().optional(),
  hostname: z.string().optional(),
});

/**
 * Verifies a Cloudflare Turnstile token on the server (Cloudflare's canonical siteverify flow).
 * When `TURNSTILE_HOSTNAMES` is set (on Vercel), the token must also carry the `register` action
 * and come from one of those hostnames. Network or parse errors count as failure. Failures are
 * logged with a short reason only (no token, no IP), so a wrong secret key
 * (`invalid-input-secret`) can be told apart from a reused token in the Vercel logs.
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return false;
  const env = serverEnv();
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
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
    const reason = rejectReason(
      {
        success: parsed.data.success,
        action: parsed.data.action,
        hostname: parsed.data.hostname,
        errorCodes: parsed.data["error-codes"] ?? [],
      },
      parseHostnames(env.TURNSTILE_HOSTNAMES),
    );
    if (reason) console.warn(`[turnstile] ${reason}`);
    return reason === null;
  } catch (error) {
    console.warn(
      `[turnstile] siteverify request failed: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return false;
  }
}
