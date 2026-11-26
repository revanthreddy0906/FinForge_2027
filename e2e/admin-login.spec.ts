import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/** Console pages without a database: access control, form errors, rate limit, accessibility. */

test("the console sends signed-out visitors to sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Organizer sign-in" })).toBeVisible();
});

test("the CSV export is not available when signed out", async ({ page, request }) => {
  const res = await request.get("/admin/export", { maxRedirects: 0 });
  expect([303, 307]).toContain(res.status());
  expect(res.headers().location).toMatch(/\/admin\/login$/);
  await page.goto("/admin/export");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("console pages are never indexed", async ({ page, request }) => {
  const res = await request.get("/admin/login");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/admin/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/admin/);
});

test("sign-in shows clear errors for missing details", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter the email address of your organizer account.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
});

test("sign-in is rate limited after 5 tries a minute", async ({ page }) => {
  await page.goto("/admin/login");
  const alert = page.getByTestId("login-error");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password").fill(`wrong-${String(i)}`);
    await page.getByRole("button", { name: "Continue" }).click();
    // No database here, so each try fails as "couldn't sign in", not as a crash.
    await expect(alert).toContainText(/couldn't sign you in|don't match/);
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  }
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByLabel("Password").fill("wrong-again");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(alert).toHaveText(/Too many attempts/);
});

test("sign-in page has no accessibility violations", async ({ page }) => {
  await page.goto("/admin/login");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
