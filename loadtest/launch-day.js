// Launch-day model: 1,000 visitors browse while teams register at the same time.
// Registrants open /register, fill the form, submit (team saved, Razorpay TEST order created),
// and stop at the payment pop-up: no payment is ever made. 10% retry the same submit (double
// click / flaky network) to check idempotency: the retry must return the same order.
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import exec from "k6/execution";
import {
  BASE_URL,
  actionBody,
  actionHeaders,
  actionResult,
  checkPage,
  pageHeaders,
  testTeam,
  think,
} from "./lib.js";
import visitor from "./public-pages.js";

const VUS = Number(__ENV.VUS ?? 1000);
const TEAMS = Number(__ENV.TEAMS ?? 150);
const REGISTRANTS = Number(__ENV.REGISTRANTS ?? 50);

const registerTime = new Trend("register_submit_duration", true);
const orders = new Counter("register_orders_created");
const outcomes = new Counter("register_outcomes");

export const options = {
  scenarios: {
    visitors: {
      executor: "ramping-vus",
      exec: "browse",
      startVUs: 0,
      stages: [
        { duration: "1m", target: VUS },
        { duration: __ENV.HOLD ?? "4m", target: VUS },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    registrants: {
      executor: "shared-iterations",
      exec: "register",
      vus: REGISTRANTS,
      iterations: TEAMS,
      startTime: "1m",
      maxDuration: "4m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{page:home}": ["p(95)<500"],
    "http_req_duration{page:register}": ["p(95)<500"],
    "http_req_duration{page:static}": ["p(95)<500"],
    register_submit_duration: ["p(95)<2000"],
    "checks{step:submit}": ["rate>0.99"],
  },
};

export function browse() {
  visitor();
}

export function register() {
  const id = `${String(exec.vu.idInTest)}-${String(exec.vu.iterationInScenario)}`;
  const page = http.get(`${BASE_URL}/register`, {
    headers: pageHeaders(),
    tags: { page: "register" },
  });
  checkPage(page, "register");
  sleep(think(5, 20)); // filling in the form

  const team = testTeam(id, 2 + Math.floor(Math.random() * 4));
  // One rate-limit client per team, as each team registers from its own device.
  const headers = actionHeaders(`team-${id}`);
  const res = http.post(`${BASE_URL}/register`, actionBody(team), {
    headers,
    tags: { page: "submit" },
  });
  registerTime.add(res.timings.duration);
  const result = actionResult(res);
  const orderId = result?.status === "payment" ? result.payment.orderId : null;
  outcomes.add(1, { status: result?.status ?? "unparsed", message: result?.message ?? "" });
  if (orderId) orders.add(1);
  else
    console.warn(
      `submit ${String(res.status)}: ${result?.message ?? ""} ${typeof res.body === "string" ? res.body.slice(0, 600) : ""}`,
    );
  check(
    res,
    {
      "submit is 200": (r) => r.status === 200,
      "submit reaches payment with a Razorpay order": () => orderId !== null,
      "fee is 699 per member": () => result?.payment?.amountPaise === 69900 * team.members.length,
    },
    { step: "submit" },
  );

  if (orderId && Math.random() < 0.1) {
    sleep(think(0.2, 2));
    const retry = http.post(`${BASE_URL}/register`, actionBody(team), {
      headers,
      tags: { page: "submit-retry" },
    });
    const again = actionResult(retry);
    check(
      retry,
      { "retry returns the same order": () => again?.payment?.orderId === orderId },
      { step: "retry" },
    );
  }
}
