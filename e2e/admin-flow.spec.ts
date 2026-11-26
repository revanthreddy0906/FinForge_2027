import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { totp, totpWindow } from "./totp";

/**
 * Full organizer flow against the STAGING database: first sign-in with authenticator set-up,
 * the teams table, CSV export, sign out, and a second sign-in with the code only.
 *
 * Needs e2e-admin@example.com in staging's private.admin_allowlist (inserted once by hand).
 * The test user is deleted and recreated each run, so it always starts without an
 * authenticator factor.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const EMAIL = "e2e-admin@example.com";
const PASSWORD = `E2e-${crypto.randomUUID()}`;
let secret = "";
let lastWindow = -1;

test.beforeAll(async () => {
  const url = process.env.E2E_SUPABASE_URL ?? "";
  const key = process.env.E2E_SUPABASE_SECRET_KEY ?? "";
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const user of data.users.filter((u) => u.email === EMAIL)) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
  }
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) throw created.error;
});

/** A fresh code; waits for the next 30 s window if this one was already used. */
async function freshCode(page: Page): Promise<string> {
  while (totpWindow() === lastWindow) await page.waitForTimeout(1_000);
  lastWindow = totpWindow();
  return totp(secret);
}

async function signInWithPassword(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("login-error")).toHaveText(/don't match an organizer account/);
});

test("first sign-in sets up the authenticator and opens the console", async ({ page }) => {
  await signInWithPassword(page);
  await expect(page.getByRole("heading", { name: "Set up your authenticator app" })).toBeFocused();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  secret = ((await page.getByTestId("totp-secret").textContent()) ?? "").replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

  // A wrong code keeps the QR step and explains what to do.
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Open the console" }).click();
  await expect(page.getByTestId("login-error")).toHaveText(/That code didn't work/);
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();

  await page.getByLabel("6-digit code").fill(await freshCode(page));
  await page.getByRole("button", { name: "Open the console" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Registered teams" })).toBeVisible();
  await expect(page.getByText(`Signed in as ${EMAIL}`)).toBeVisible();
});

test("shows teams, searches, exports CSV and signs out", async ({ page }) => {
  await signInWithPassword(page);
  await expect(page.getByRole("heading", { name: "Enter your authenticator code" })).toBeFocused();
  await page.getByLabel("6-digit code").fill(await freshCode(page));
  await page.getByRole("button", { name: "Open the console" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Staging holds the teams that the registration e2e tests create.
  const count = Number(await page.getByTestId("team-count").textContent());
  expect(count).toBeGreaterThan(0);
  await expect(page.getByText(`Showing ${String(count)} of ${String(count)} teams`)).toBeVisible();
  await page.getByLabel("Search teams").fill("no-team-is-called-this");
  await expect(page.getByText(`Showing 0 of ${String(count)} teams`)).toBeVisible();
  await page.getByLabel("Search teams").fill("");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^finforge-2027-registrations-\d{4}-\d{2}-\d{2}\.csv$/);
  const chunks: Buffer[] = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv.replace(/^﻿/, "").split("\r\n")[0]).toBe(
    '"Reference","Team","College","Status","Registered (IST)","Member #","Role","Name","Email","Leader mobile"',
  );
  expect(csv).toMatch(/"FF27-\d{4,}"/);

  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("a password alone (no code) can't open the console", async ({ page }) => {
  await signInWithPassword(page);
  await expect(page.getByRole("heading", { name: "Enter your authenticator code" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  const res = await page.request.get("/admin/export", { maxRedirects: 0 });
  expect([303, 307]).toContain(res.status());
});
