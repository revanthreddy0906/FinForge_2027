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
