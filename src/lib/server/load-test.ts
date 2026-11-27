import "server-only";
import { timingSafeEqual } from "node:crypto";

export const LOAD_TEST_HEADER = "x-finforge-load-test";
export const LOAD_TEST_CLIENT_HEADER = "x-finforge-load-test-client";

const MIN_SECRET_LENGTH = 32;
const CLIENT_ID = /^[A-Za-z0-9-]{1,40}$/;

interface LoadTestInput {
  /** process.env.VERCEL_ENV */
  vercelEnv: string | undefined;
  /** process.env.FINFORGE_LOAD_TEST_SECRET */
  secret: string | undefined;
  header: string | null;
  client: string | null;
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Rate-limit key for a request. A k6 load test sends every request from one machine, so all
 * virtual users share one IP and the 5-a-minute limit would stop the test after 5 teams. On a
 * Vercel **preview** deployment only, a request that carries the load-test secret (set as a
 * branch-scoped preview variable) is limited per virtual user instead of per IP: the limiter
 * still runs (same Upstash calls, same limit), just with a per-user key.
 *
 * Never active in production or outside Vercel, whatever the variables say.
 */
export function rateLimitKey(ip: string, input: LoadTestInput): string {
  if (input.vercelEnv !== "preview") return ip;
  const { secret, header, client } = input;
  if (!secret || secret.length < MIN_SECRET_LENGTH || !header) return ip;
  if (!sameSecret(header, secret)) return ip;
  if (!client || !CLIENT_ID.test(client)) return ip;
  return `load-test:${client}`;
}
