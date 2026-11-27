// Worst case for the database: registration opens and every team presses "Register team" in the
// same second. 75 teams (the expected total) submit at once, while 10 more race for one team name
// to check that exactly one wins. Each successful submit creates one Razorpay TEST order; no
// payment is made.
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import exec from "k6/execution";
import { BASE_URL, RUN, actionBody, actionHeaders, actionResult, testTeam } from "./lib.js";

const TEAMS = Number(__ENV.TEAMS ?? 75);
const RACERS = Number(__ENV.RACERS ?? 10);

const submitTime = new Trend("spike_submit_duration", true);
const raceWins = new Counter("race_wins");
const raceHeld = new Counter("race_held");
const firstTry = new Counter("spike_payment_on_first_try");
const retried = new Counter("spike_payment_after_retry");

const PAYMENT_UNAVAILABLE = "Your team is saved, but we couldn't start the payment";

export const options = {
  scenarios: {
    spike: { executor: "per-vu-iterations", exec: "spike", vus: TEAMS, iterations: 1 },
    race: { executor: "per-vu-iterations", exec: "race", vus: RACERS, iterations: 1 },
  },
  thresholds: {
    "checks{step:spike}": ["rate==1"],
    "checks{step:race}": ["rate==1"],
    "spike_submit_duration{page:spike}": ["p(95)<3000"],
  },
};

function submit(team, clientId, tag) {
  const res = http.post(`${BASE_URL}/register`, actionBody(team), {
    headers: actionHeaders(clientId),
    tags: { page: tag },
  });
  submitTime.add(res.timings.duration, { page: tag });
  return { res, result: actionResult(res) };
}

export function spike() {
  const id = `spike-${String(exec.vu.idInTest)}`;
  const team = testTeam(id, 4);
  let { res, result } = submit(team, id, "spike");
  if (result?.status === "payment") firstTry.add(1);
  // A real user who sees "couldn't start the payment" presses Register team again a little later.
  for (
    let attempt = 0;
    attempt < 3 && (result?.message ?? "").startsWith(PAYMENT_UNAVAILABLE);
    attempt++
  ) {
    console.warn(`spike: payment unavailable for ${id}, retrying`);
    sleep(3 + Math.random() * 3);
    ({ res, result } = submit(team, id, "spike-retry"));
    if (result?.status === "payment") retried.add(1);
  }
  check(
    res,
    {
      "spike submit is 200": (r) => r.status === 200,
      "spike team reaches payment (with up to 3 user retries)": () => result?.status === "payment",
    },
    { step: "spike" },
  );
  if (result?.status !== "payment") console.warn(`spike: ${result?.message ?? String(res.status)}`);
}

export function race() {
  const id = `race-${String(exec.vu.idInTest)}`;
  const team = { ...testTeam(id, 2), teamName: `${RUN} race team` };
  const { res, result } = submit(team, id, "race");
  const won = result?.status === "payment";
  const held = (result?.message ?? "").startsWith("A team with this name is waiting to pay");
  if (won) raceWins.add(1);
  if (held) raceHeld.add(1);
  check(
    res,
    { "race submit either wins or is told the name is held": () => won || held },
    { step: "race" },
  );
  if (!won && !held) console.warn(`race: ${result?.message ?? String(res.status)}`);
}
