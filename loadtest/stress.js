// Stress ramp on the public pages: step up past the 1,000 target towards 2,000 (the safety
// margin) to find where latency or errors break. Aborts early if errors pass 5%.
import http from "k6/http";
import { sleep } from "k6";
import { BASE_URL, checkPage, pageHeaders, think } from "./lib.js";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 500 },
        { duration: "1m", target: 1000 },
        { duration: "1m", target: 1500 },
        { duration: "1m", target: 2000 },
        { duration: "2m", target: 2000 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "30s" }],
    http_req_duration: ["p(95)<500"],
  },
};

export default function visitor() {
  const path = Math.random() < 0.7 ? "/" : "/register";
  const page = path === "/" ? "home" : "register";
  const res = http.get(`${BASE_URL}${path}`, { headers: pageHeaders(), tags: { page } });
  checkPage(res, page);
  sleep(think(2, 5));
}
