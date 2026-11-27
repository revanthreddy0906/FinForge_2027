// 1,000 concurrent visitors browsing the public pages (design target, CLAUDE.md section 2/8).
// Each virtual user opens the home page, reads, then opens /register like a real visitor.
import http from "k6/http";
import { sleep } from "k6";
import { BASE_URL, checkPage, pageHeaders, think } from "./lib.js";

const VUS = Number(__ENV.VUS ?? 1000);

export const options = {
  discardResponseBodies: false,
  scenarios: {
    visitors: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: VUS },
        { duration: __ENV.HOLD ?? "3m", target: VUS },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{page:home}": ["p(95)<500"],
    "http_req_duration{page:register}": ["p(95)<500"],
    "http_req_duration{page:static}": ["p(95)<500"],
  },
};

let staticAsset = null;

export default function visitor() {
  const home = http.get(`${BASE_URL}/`, { headers: pageHeaders(), tags: { page: "home" } });
  checkPage(home, "home");
  // One of the page's own static files, as the browser would fetch it (served by the CDN).
  if (staticAsset === null && typeof home.body === "string") {
    const m = home.body.match(/\/_next\/static\/[^"']+\.css/);
    staticAsset = m ? m[0] : "";
  }
  if (staticAsset) {
    http.get(`${BASE_URL}${staticAsset}`, { headers: pageHeaders(), tags: { page: "static" } });
  }
  sleep(think(3, 8));
  const reg = http.get(`${BASE_URL}/register`, {
    headers: pageHeaders(),
    tags: { page: "register" },
  });
  checkPage(reg, "register");
  sleep(think(3, 8));
}
