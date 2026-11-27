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

/** Run marker in every test team name and email, so cleanup can find exactly these rows. */
export const RUN = __ENV.RUN ?? "k6lt";

/** Server action id of registerAction for this build (see capture-action.cjs). */
export const ACTION_ID = __ENV.ACTION_ID;

/**
 * Server-only load-test secret (FINFORGE_LOAD_TEST_SECRET on the load-test branch). With it the
 * registration rate limit counts per virtual user instead of per IP. Optional: without it the
 * normal 5-a-minute-per-IP limit applies.
 */
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET;

export function uuid() {
  const h = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else if (i === 19) s += h[8 + Math.floor(Math.random() * 4)];
    else s += h[Math.floor(Math.random() * 16)];
  }
  return s;
}

/** A valid team of `size` members, unique to this run, VU and iteration. */
export function testTeam(id, size) {
  const members = [];
  for (let i = 0; i < size; i++) {
    members.push({
      fullName: `Load Tester ${String(i + 1)}`,
      email: `${RUN}-${id}-${String(i)}@example.com`,
    });
  }
  return {
    teamName: `${RUN} team ${id}`,
    institution: "Load Test College",
    leaderPhone: "9876543210",
    members,
    idempotencyKey: uuid(),
  };
}

const BOUNDARY = "----FinForgeK6Boundary7MA4YWxkTrZu0gW";

/**
 * Encodes fields as multipart/form-data (k6 only sends multipart when a file is attached).
 * React's root field "0" must come last: the server decodes the stream in order, and JS objects
 * list integer-like keys first, so it is appended separately.
 */
export function multipart(fields) {
  let out = "";
  const entries = Object.entries(fields).filter(([name]) => name !== "0");
  if ("0" in fields) entries.push(["0", fields["0"]]);
  for (const [name, value] of entries) {
    out += `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  return `${out}--${BOUNDARY}--\r\n`;
}

/** Builds the multipart body React sends for registerAction(prevState, formData). */
export function actionBody(team) {
  const body = {
    _1_teamName: team.teamName,
    _1_institution: team.institution,
    _1_leaderPhone: team.leaderPhone,
    _1_consent: "on",
    // Cloudflare's dummy token; only the always-pass TEST secret accepts it.
    "_1_cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
    _1_idempotencyKey: team.idempotencyKey,
    0: '[{"status":"idle"},"$K1"]',
  };
  team.members.forEach((m, i) => {
    body[`_1_members.${String(i)}.fullName`] = m.fullName;
    body[`_1_members.${String(i)}.email`] = m.email;
  });
  return multipart(body);
}

export function actionHeaders(clientId) {
  if (!ACTION_ID) throw new Error("Set ACTION_ID (run loadtest/capture-action.cjs)");
  const h = {
    "x-vercel-protection-bypass": BYPASS,
    "Next-Action": ACTION_ID,
    Accept: "text/x-component",
    "Content-Type": `multipart/form-data; boundary=${BOUNDARY}`,
    Origin: BASE_URL,
    Referer: `${BASE_URL}/register`,
    "User-Agent": "FinForge-k6-load-test",
  };
  if (LOAD_TEST_SECRET && clientId) {
    h["x-finforge-load-test"] = LOAD_TEST_SECRET;
    h["x-finforge-load-test-client"] = clientId;
  }
  return h;
}

/** Reads the action result out of the RSC response ("1:{...}" line). */
export function actionResult(res) {
  if (typeof res.body !== "string") return null;
  const line = res.body.split("\n").find((l) => l.startsWith("1:"));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(2));
  } catch {
    return null;
  }
}
