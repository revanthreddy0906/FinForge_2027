// Checks the real registration rate limit (no load-test secret): from one IP, submits past the limit
// (LIMIT, default 20 a minute) are refused with the friendly message. Sends INVALID forms (the limit is checked before
// validation), so nothing is saved and no Razorpay order is created. Also tries a forged
// X-Forwarded-For to confirm a client can't pick its own rate-limit IP.
import http from "k6/http";
import { check } from "k6";
import { BASE_URL, actionHeaders, actionResult, multipart } from "./lib.js";

export const options = { vus: 1, iterations: 1 };

const LIMIT = Number(__ENV.LIMIT ?? 20);

const RATE_LIMITED = "Too many attempts from your network";

function submit(extraHeaders) {
  const headers = { ...actionHeaders(null), ...extraHeaders };
  const res = http.post(
    `${BASE_URL}/register`,
    multipart({ _1_teamName: "", 0: '[{"status":"idle"},"$K1"]' }),
    { headers },
  );
  return actionResult(res);
}

export default function checkLimit() {
  const results = [];
  for (let i = 0; i < LIMIT + 2; i++) results.push(submit({}));
  const limited = results.map((r) => (r?.message ?? "").startsWith(RATE_LIMITED));
  console.log(`plain: ${JSON.stringify(limited)}`);
  check(null, {
    // The sliding window also counts last minute's submits, so wait a minute before running.
    "submits up to the limit are not rate limited": () => limited.slice(0, LIMIT).every((x) => !x),
    "the two submits past the limit are rate limited": () => limited.slice(LIMIT).every((x) => x),
  });

  const spoofed = [];
  for (let i = 0; i < 3; i++) {
    const r = submit({
      "X-Forwarded-For": `198.51.100.${String(10 + i)}`,
      "X-Real-IP": `198.51.100.${String(10 + i)}`,
    });
    spoofed.push((r?.message ?? "").startsWith(RATE_LIMITED));
  }
  console.log(`forged X-Forwarded-For: ${JSON.stringify(spoofed)}`);
  check(null, { "forged X-Forwarded-For is still rate limited": () => spoofed.every((x) => x) });
}
