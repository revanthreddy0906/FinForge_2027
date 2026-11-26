import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "./env";

const LIMIT = 5;
const WINDOW_MS = 60_000;

let upstash: Ratelimit | undefined;
const memory = new Map<string, number[]>();

/** In-memory sliding window for local development and tests only (one process, not shared). */
function allowInMemory(key: string): boolean {
  const now = Date.now();
  const recent = (memory.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    memory.set(key, recent);
    return false;
  }
  recent.push(now);
  memory.set(key, recent);
  return true;
}

/**
 * 5 requests per minute per IP and action. Uses Upstash Redis when configured. In production
 * Upstash is required: without it this throws, and the caller fails closed.
 */
export async function allowRequest(action: string, ip: string): Promise<boolean> {
  const env = serverEnv();
  const key = `${action}:${ip}`;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    upstash ??= new Ratelimit({
      redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
      limiter: Ratelimit.slidingWindow(LIMIT, "1 m"),
      prefix: "ff27:rl",
      analytics: false,
    });
    const { success } = await upstash.limit(key);
    return success;
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.FINFORGE_ALLOW_MEMORY_RATE_LIMIT !== "1"
  ) {
    throw new Error("Upstash rate limiting is not configured");
  }
  return allowInMemory(key);
}
