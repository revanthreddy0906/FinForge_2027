import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Selection pages on the server with no database: they must still load cleanly, say what went
 * wrong in plain words, and never show a raw error. The full flow is statements-flow.spec.ts.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    // The page reports the failed database read on the server, never in the browser.
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the selection page explains when it can't check the window", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/statements");
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose your problem statement" }),
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "This page couldn't load" })).toBeVisible();
  // No statement texts, and no form, unless the window is open.
  await expect(page.getByText("TODO: problem statement")).toHaveCount(0);
  await expect(page.getByLabel("Team reference")).toHaveCount(0);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("the results page explains when results can't load", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/statements/results");
  await expect(
    page.getByRole("heading", { level: 1, name: "Problem statement results" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Results couldn't load" })).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("the organizer panel and its downloads need a sign-in", async ({ page }) => {
  await page.goto("/admin/statements");
  await expect(page).toHaveURL(/\/admin\/login$/);
  for (const path of ["/admin/statements/export"]) {
    const res = await page.request.get(path, { maxRedirects: 0 });
    expect([303, 307]).toContain(res.status());
  }
});

test("the statement texts are not in the browser bundle", async ({ page }) => {
  await page.goto("/register");
  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map((s) => (s as HTMLScriptElement).src),
  );
  for (const src of scripts) {
    const body = await (await page.request.get(src)).text();
    expect(body, src).not.toContain("TODO: problem statement");
  }
});
