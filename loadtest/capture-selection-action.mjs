// Prints the submitSelectionAction server-action id of a build (it changes with each build).
// Opens /statements in Chrome while selection is open, submits an unknown reference (FF27-9999,
// so nothing is saved), and prints the Next-Action header and the response.
// Usage: VERCEL_BYPASS=... NODE_PATH=node_modules node loadtest/capture-selection-action.mjs <preview-url>
import { chromium } from "playwright";
(async () => {
  const base = process.argv[2];
  const bypass = process.env.VERCEL_BYPASS ?? "";
  const b = await chromium.launch({ channel: "chrome" });
  const p = await (await b.newContext()).newPage();
  p.on("request", (r) => {
    if (r.method() === "POST") console.log("next-action:", r.headers()["next-action"]);
  });
  p.on("response", async (r) => {
    if (r.request().method() === "POST") {
      console.log("RESP", r.status());
      try {
        console.log((await r.text()).slice(0, 600));
      } catch {}
    }
  });
  await p.goto(
    `${base}/statements?x-vercel-protection-bypass=${bypass}&x-vercel-set-bypass-cookie=samesitenone`,
    { waitUntil: "load" },
  );
  await p.getByLabel("Team reference").fill("FF27-9999");
  await p.getByRole("button", { name: "Review our choices" }).click();
  await p.getByRole("button", { name: "Submit our choices" }).click();
  await p.waitForTimeout(6000);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
