import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type AdminEnv = z.infer<typeof schema>;

let cached: AdminEnv | undefined;

/**
 * Settings for the organizer console. Separate from serverEnv so a missing admin value never
 * breaks public registration. The publishable key is public by design, but the console only
 * uses it on the server, so it has no NEXT_PUBLIC_ prefix.
 */
export function adminEnv(): AdminEnv {
  cached ??= schema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}
