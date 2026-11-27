// Finds the registerAction server-action id of a build (it changes with each build): opens
// /register in Chrome, submits one valid test team, and prints the Next-Action header and the
// response. Creates ONE test team + Razorpay test order (removed by cleanup.sql).
// Usage: node loadtest/capture-action.mjs <preview-url>
// The bypass secret is read from the VERCEL_BYPASS environment variable.
import { chromium } from "playwright";
(async () => {
  const base = process.argv[2];
  const bypass = process.env.VERCEL_BYPASS ?? "";
  const b = await chromium.launch({ channel: "chrome" });
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  p.on("request", (r) => {
    if (r.method() === "POST") {
      console.log("POST", r.url());
      console.log("next-action:", r.headers()["next-action"]);
      console.log("BODY", r.postData());
    }
  });
  p.on("response", async (r) => {
    if (r.request().method() === "POST") {
      console.log("RESP", r.status());
      try {
        console.log((await r.text()).slice(0, 1500));
      } catch {}
    }
  });
  await p.goto(
    base +
      "/register?x-vercel-protection-bypass=" +
      bypass +
      "&x-vercel-set-bypass-cookie=samesitenone",
    { waitUntil: "load" },
  );
  await p.goto(base + "/register", { waitUntil: "load" });
  const run = Date.now().toString(36);
  await p.fill("[name=teamName]", "k6lt capture " + run);
  await p.fill("[name=institution]", "Load Test College");
  await p.fill("[name=leaderPhone]", "9876543210");
  await p.fill('[name="members.0.fullName"]', "Load Tester One");
  await p.fill('[name="members.0.email"]', `k6lt-${run}-a@example.com`);
  await p.fill('[name="members.1.fullName"]', "Load Tester Two");
  await p.fill('[name="members.1.email"]', `k6lt-${run}-b@example.com`);
  await p.check("[name=consent]");
  await p.waitForFunction(
    () => {
      const i = document.querySelector('[name="cf-turnstile-response"]');
      return i && i.value.length > 0;
    },
    null,
    { timeout: 30000 },
  );
  await p.click("button[type=submit]");
  await p.waitForTimeout(8000);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
