import { test as base, expect, type Page } from "@playwright/test";

/**
 * Replaces the Cloudflare Turnstile script with a local stand-in that behaves like the
 * always-pass test widget: it adds the hidden token input and calls back, and issues a new
 * token on reset. Keeps the tests independent of Cloudflare's network.
 */
const fakeTurnstile = `
window.turnstile = {
  _w: {},
  render(el, opts) {
    const id = "w" + Math.random().toString(36).slice(2);
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cf-turnstile-response";
    el.appendChild(input);
    const issue = () => { input.value = "XXXX.DUMMY.TOKEN.XXXX"; setTimeout(() => opts.callback && opts.callback(input.value), 0); };
    this._w[id] = issue;
    issue();
    return id;
  },
  reset(id) { const issue = this._w[id]; if (issue) issue(); },
  remove(id) { delete this._w[id]; },
};`;

/**
 * Replaces Razorpay's checkout.js with a stand-in. open() acts on window.__rzpMode:
 * "pay" (default) pays through the local Razorpay stub and calls the success handler,
 * "dismiss" closes the pop-up, "fail" reports a failed payment and then closes.
 * Payment goes through https://api.razorpay.com/e2e/pay, which the CSP allows on /register
 * and the test intercepts below.
 */
const fakeCheckout = `
window.Razorpay = function (options) {
  const failed = [];
  return {
    on(name, fn) { if (name === "payment.failed") failed.push(fn); },
    open() {
      const mode = window.__rzpMode || "pay";
      setTimeout(async () => {
        if (mode === "dismiss") return options.modal.ondismiss();
        if (mode === "fail") { failed.forEach((fn) => fn({ error: { code: "BAD_REQUEST_ERROR" } })); return options.modal.ondismiss(); }
        const res = await fetch("https://api.razorpay.com/e2e/pay", { method: "POST", body: JSON.stringify({ order_id: options.order_id }) });
        options.handler(await res.json());
      }, 50);
    },
  };
};`;

const RAZORPAY_STUB = "http://127.0.0.1:3199";

export const test = base.extend({
  // A unique client IP per test, so rate limits from one test never affect another.
  extraHTTPHeaders: async ({}, provide) => {
    const n = () => Math.floor(Math.random() * 250) + 1;
    await provide({ "x-forwarded-for": `10.${String(n())}.${String(n())}.${String(n())}` });
  },
  page: async ({ page }, provide) => {
    await page.route("https://challenges.cloudflare.com/turnstile/**", (route) =>
      route.fulfill({ contentType: "text/javascript", body: fakeTurnstile }),
    );
    await page.route("https://checkout.razorpay.com/**", (route) =>
      route.fulfill({ contentType: "text/javascript", body: fakeCheckout }),
    );
    await page.route("https://api.razorpay.com/e2e/pay", async (route) => {
      // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- local test stub on 127.0.0.1, never a real network
      const res = await fetch(`${RAZORPAY_STUB}/test/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: route.request().postData() ?? "{}",
      });
      await route.fulfill({
        status: res.status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: await res.text(),
      });
    });
    await provide(page);
  },
});

export { expect };

export interface TeamDetails {
  teamName: string;
  college: string;
  phone: string;
  members: { name: string; email: string }[];
}

export async function fillTeam(page: Page, team: TeamDetails) {
  await page.getByLabel("Team name").fill(team.teamName);
  await page.getByLabel("College").fill(team.college);
  for (const [i, member] of team.members.entries()) {
    if (i >= 2) await page.getByRole("button", { name: /Add a member/ }).click();
    await page.locator(`#f-members-${String(i)}-fullName`).fill(member.name);
    await page.locator(`#f-members-${String(i)}-email`).fill(member.email);
  }
  await page.getByLabel("Mobile number").fill(team.phone);
  await page.getByRole("checkbox", { name: /privacy note/ }).check();
}

/** How the stand-in checkout behaves the next time Pay is pressed. */
export async function setCheckoutMode(page: Page, mode: "pay" | "dismiss" | "fail") {
  await page.evaluate((m) => {
    (window as unknown as { __rzpMode: string }).__rzpMode = m;
  }, mode);
}
