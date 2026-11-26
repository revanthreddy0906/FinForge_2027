import "server-only";
import { z } from "zod";
import { serverEnv } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const responseSchema = z.object({ success: z.boolean() });

/** Verifies a Cloudflare Turnstile token on the server. Network or parse errors count as failure. */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const body = new URLSearchParams({ secret: serverEnv().TURNSTILE_SECRET_KEY, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const parsed = responseSchema.safeParse(await res.json());
    return parsed.success && parsed.data.success;
  } catch {
    return false;
  }
}
