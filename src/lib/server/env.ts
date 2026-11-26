import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  TURNSTILE_SECRET_KEY: z.string().min(10),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

/** Treats an empty string (as left by a blank line in .env) as unset. */
const optional = (v: string | undefined) => (v === "" ? undefined : v);

let cached: ServerEnv | undefined;

/**
 * Server-only settings. Throws (and the caller shows a friendly "try again" message) when a
 * required value is missing, so a misconfigured deploy fails closed instead of half-working.
 */
export function serverEnv(): ServerEnv {
  cached ??= schema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    UPSTASH_REDIS_REST_URL: optional(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: optional(process.env.UPSTASH_REDIS_REST_TOKEN),
  });
  return cached;
}
