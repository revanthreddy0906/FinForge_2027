import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "./env";

const LIMIT = 5;
const WINDOW_MS = 60_000;

const limiters = new Map<number, Ratelimit>();
const memory = new Map<string, number[]>();

/** In-memory sliding window for local development and tests only (one process, not shared). */
function allowInMemory(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (memory.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    memory.set(key, recent);
    return false;
  }
  recent.push(now);
  memory.set(key, recent);
  return true;
}

/**
 * `limit` requests (default 5) per minute per IP and action. Uses Upstash Redis when configured. In production
 * Upstash is required: without it this throws, and the caller fails closed.
 */
export async function allowRequest(
  action: string,
  ip: string,
  limit: number = LIMIT,
): Promise<boolean> {
  const env = serverEnv();
  const key = `${action}:${ip}`;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    let limiter = limiters.get(limit);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
        limiter: Ratelimit.slidingWindow(limit, "1 m"),
        prefix: limit === LIMIT ? "ff27:rl" : `ff27:rl${String(limit)}`,
        analytics: false,
      });
      limiters.set(limit, limiter);
    }
    const { success } = await limiter.limit(key);
    return success;
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.FINFORGE_ALLOW_MEMORY_RATE_LIMIT !== "1"
  ) {
    throw new Error("Upstash rate limiting is not configured");
  }
  return allowInMemory(key, limit);
}
