// Event-day problem statement selection, worst case: the window opens and all 75 teams press
// "Submit our choices" in the same second, from ONE IP (the venue Wi-Fi). Each team sends a random
// ranking. 5 more requests repeat team 1's submit at the same moment (double taps), which must
// all get "already submitted" or be the single saved entry.
//
// Needs 75 paid test teams on STAGING with references REF_START .. REF_START+74 (see
// loadtest/selection-setup.sql) and the selection window open. Never run against production.
//   k6 run -e REF_START=1234 loadtest/selection-burst.js
import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";
import exec from "k6/execution";
import { ACTION_ID, BASE_URL, multipart } from "./lib.js";

const TEAMS = Number(__ENV.TEAMS ?? 75);
const DOUBLE_TAPS = Number(__ENV.DOUBLE_TAPS ?? 5);
const REF_START = Number(__ENV.REF_START);
if (!Number.isInteger(REF_START))
  throw new Error("Set REF_START to the first test reference number");

const submitTime = new Trend("selection_submit_duration", true);
const saved = new Counter("selection_saved");
const repeats = new Counter("selection_already_submitted");

export const options = {
  scenarios: {
    burst: { executor: "per-vu-iterations", exec: "burst", vus: TEAMS, iterations: 1 },
    doubleTap: {
      executor: "per-vu-iterations",
      exec: "doubleTap",
      vus: DOUBLE_TAPS,
      iterations: 1,
    },
  },
  thresholds: {
    "checks{step:burst}": ["rate==1"],
    "checks{step:double}": ["rate==1"],
    "selection_submit_duration{step:burst}": ["p(95)<3000"],
  },
};

const reference = (n) => `FF27-${String(REF_START + n).padStart(4, "0")}`;

function shuffled() {
  return [1, 2, 3, 4]
    .map((v) => ({ v, k: Math.random() }))
    .sort((x, y) => x.k - y.k)
    .map((x) => x.v)
    .join(",");
}

function submit(ref, step) {
  if (!ACTION_ID) throw new Error("Set ACTION_ID (node loadtest/capture-selection-action.mjs)");
  const body = multipart({
    _1_reference: ref,
    _1_ranking: shuffled(),
    0: '[{"status":"idle"},"$K1"]',
  });
  const res = http.post(`${BASE_URL}/statements`, body, {
    headers: {
      "x-vercel-protection-bypass": __ENV.VERCEL_BYPASS,
      "Next-Action": ACTION_ID,
      Accept: "text/x-component",
      "Content-Type": "multipart/form-data; boundary=----FinForgeK6Boundary7MA4YWxkTrZu0gW",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/statements`,
      "User-Agent": "FinForge-k6-load-test",
    },
    tags: { step },
  });
  submitTime.add(res.timings.duration, { step });
  const line =
    typeof res.body === "string" ? res.body.split("\n").find((l) => l.startsWith("1:")) : null;
  let result = null;
  try {
    result = line ? JSON.parse(line.slice(2)) : null;
  } catch {
    result = null;
  }
  if (result?.status === "submitted") saved.add(1);
  if (result?.status === "already-submitted") repeats.add(1);
  return { res, result };
}

export function burst() {
  const ref = reference(exec.vu.idInTest - 1);
  const { res, result } = submit(ref, "burst");
  check(
    res,
    {
      "burst submit is 200": (r) => r.status === 200,
      "burst team's choice is saved once": () =>
        result?.status === "submitted" || result?.status === "already-submitted",
    },
    { step: "burst" },
  );
  if (result?.status !== "submitted" && result?.status !== "already-submitted") {
    console.warn(`burst ${ref}: ${result?.message ?? String(res.status)}`);
  }
}

export function doubleTap() {
  const { res, result } = submit(reference(0), "double");
  check(
    res,
    {
      "double tap is 200": (r) => r.status === 200,
      "double tap is saved or told it already submitted": () =>
        result?.status === "submitted" || result?.status === "already-submitted",
    },
    { step: "double" },
  );
}
