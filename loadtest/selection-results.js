// The moment organizers press Publish: 1,000 people refresh the results page at once, and keep
// refreshing it. Run on STAGING after publishing the burst test's results.
//   k6 run -e EXPECT=FF27-1234 loadtest/selection-results.js
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, pageHeaders, think } from "./lib.js";

const VUS = Number(__ENV.VUS ?? 1000);
/** A reference that must appear on the published page. */
const EXPECT = __ENV.EXPECT ?? "FF27-";

export const options = {
  scenarios: {
    refreshers: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: VUS },
        { duration: __ENV.HOLD ?? "2m", target: VUS },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{page:results}": ["p(95)<500"],
    "checks{page:results}": ["rate>0.99"],
  },
};

export default function refresher() {
  const res = http.get(`${BASE_URL}/statements/results`, {
    headers: pageHeaders(),
    tags: { page: "results" },
  });
  check(
    res,
    {
      "results is 200": (r) => r.status === 200,
      "results are published": (r) => typeof r.body === "string" && r.body.includes(EXPECT),
    },
    { page: "results" },
  );
  sleep(think(2, 6));
}
