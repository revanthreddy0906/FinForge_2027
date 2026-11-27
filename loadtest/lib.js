// Shared settings for the k6 load tests. See docs/load-testing.md.
// Run against a STAGING preview only, never production.
import { check } from "k6";

export const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) throw new Error("Set BASE_URL to the load-test preview URL");
if (/^https:\/\/finforge2027\.vercel\.app/.test(BASE_URL)) {
  throw new Error("Refusing to load test production");
}

/** Vercel "Protection Bypass for Automation" secret, so k6 gets past Vercel Authentication. */
const BYPASS = __ENV.VERCEL_BYPASS;
if (!BYPASS) throw new Error("Set VERCEL_BYPASS to the automation bypass secret");

/** Headers a browser would send, plus the protection bypass. */
export function pageHeaders() {
  return {
    "x-vercel-protection-bypass": BYPASS,
    "Accept-Encoding": "br, gzip",
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "FinForge-k6-load-test",
  };
}

/** Random think time between page views, in seconds. */
export function think(min, max) {
  return min + Math.random() * (max - min);
}

export function checkPage(res, name) {
  return check(res, {
    [`${name} is 200`]: (r) => r.status === 200,
    [`${name} is the real page`]: (r) => typeof r.body === "string" && r.body.includes("FinForge"),
  });
}
