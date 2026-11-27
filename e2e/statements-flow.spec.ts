import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { totp, totpWindow } from "./totp";

/**
 * Event-day problem statement selection against the STAGING database: an organizer opens the
 * window, a team submits once (unknown reference, then its own, then a repeat), the organizer
 * closes it, assigns a team that never submitted, publishes, checks the results page and
 * unpublishes again.
 *
 * Changes staging's selection state (leaves it closed and unpublished) and leaves two paid test
 * teams ("E2E Sel ..."); supabase/tests/cleanup_staging.sql removes them. Slots fill up over many
 * runs, so the test never expects a particular statement.
 *
 * Needs e2e-selection@example.com in staging's private.admin_allowlist (inserted once by hand).
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const EMAIL = "e2e-selection@example.com";
const PASSWORD = `E2e-${crypto.randomUUID()}`;
const run = `${String(Date.now())}${Math.random().toString(36).slice(2, 6)}`;
const teams: { name: string; reference: string }[] = [];

function serviceClient() {
  return createClient(
    process.env.E2E_SUPABASE_URL ?? "",
    process.env.E2E_SUPABASE_SECRET_KEY ?? "",
    {
      auth: { persistSession: false },
    },
  );
}

/** Registers and pays for a two-member team as the server would. */
async function paidTeam(label: string): Promise<{ name: string; reference: string }> {
  const db = serviceClient();
  const name = `E2E Sel ${label} ${run}`;
  const saved = await db.rpc("register_team", {
    payload: {
      idempotency_key: crypto.randomUUID(),
      team_name: name,
      institution: "CBIT",
      leader_phone: "+919876543210",
      consent_version: "e2e",
      members: [
        { full_name: "Lead Person", email: `sel-lead-${label}-${run}@example.com` },
        { full_name: "Mate Person", email: `sel-mate-${label}-${run}@example.com` },
      ],
    },
  });
  if (saved.error) throw new Error(saved.error.message);
  const row = (saved.data as { team_id: string; reference: string }[])[0];
  if (!row) throw new Error("register_team returned nothing");
  const order = `order_E2ESEL${label}${run}`;
  const recorded = await db.rpc("record_payment_order", {
    p_team_id: row.team_id,
    p_razorpay_order_id: order,
    p_amount_paise: 139800,
  });
  if (recorded.error) throw new Error(recorded.error.message);
  const paid = await db.rpc("mark_order_paid", {
    p_razorpay_order_id: order,
    p_razorpay_payment_id: `pay_E2ESEL${label}${run}`,
    p_amount_paise: 139800,
  });
  if (paid.error) throw new Error(paid.error.message);
  return { name, reference: row.reference };
}

test.beforeAll(async () => {
  const admin = serviceClient();
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
  teams.push(await paidTeam("A"), await paidTeam("B"));
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Set up your authenticator app" })).toBeVisible();
  const secret = ((await page.getByTestId("totp-secret").textContent()) ?? "").replace(/\s/g, "");
  const start = totpWindow();
  while (totpWindow() === start) await page.waitForTimeout(1_000); // a code not used before
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Open the console" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Console errors and uncaught exceptions (CSP violations show up here). */
function collectErrors(page: Page, into: string[]) {
  page.on("console", (m) => {
    if (m.type() === "error") into.push(`${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => into.push(`${page.url()}: ${e.message}`));
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

// Next.js adds its own role="alert" route announcer, so alerts are matched by their text.
async function confirmAndPress(page: Page, box: RegExp, button: string) {
  await page.getByLabel(box).check();
  await page.getByRole("button", { name: button }).click();
}

test("a team ranks the statements once; organizers close, assign, publish and unpublish", async ({
  page,
  context,
}) => {
  const [a, b] = teams;
  if (!a || !b) throw new Error("test teams missing");
  const errors: string[] = [];
  collectErrors(page, errors);

  await test.step("organizer opens selection", async () => {
    await signIn(page);
    await page.getByRole("link", { name: "Problem statements" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Problem statements" })).toBeVisible();
    // The panel streams in after the page shell; wait for it before checking which buttons show.
    await expect(page.getByRole("heading", { name: "Selection window" })).toBeVisible();
    if (await page.getByRole("button", { name: "Unpublish results" }).isVisible()) {
      await page.getByRole("button", { name: "Unpublish results" }).click();
      await expect(page.getByRole("status")).toContainText("hidden");
    }
    if (await page.getByRole("button", { name: "Open selection" }).isVisible()) {
      // Pressing without the confirmation box does nothing and says why.
      await page.getByLabel(/Open selection now/).evaluate((el) => {
        el.removeAttribute("required");
      });
      await page.getByRole("button", { name: "Open selection" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Tick the box" })).toBeVisible();
      await confirmAndPress(page, /Open selection now/, "Open selection");
      await expect(page.getByRole("status")).toContainText("Selection is open");
    }
    await expect(page.getByRole("button", { name: "Close selection" })).toBeVisible();
    await expectAccessible(page);
  });

  const team = await context.newPage();
  collectErrors(team, errors);
  await test.step("an unknown reference is refused", async () => {
    await team.goto("/statements");
    await expect(team.getByText("Selection open")).toBeVisible();
    await expect(team.getByTestId("ranking").getByRole("listitem")).toHaveCount(4);
    await expectAccessible(team);
    await team.getByLabel("Team reference").fill("FF27-9999");
    await team.getByRole("button", { name: "Review our choices" }).click();
    await expect(team.getByTestId("review-reference")).toHaveText("FF27-9999");
    await team.getByRole("button", { name: "Submit our choices" }).click();
    await expect(
      team.getByRole("alert").filter({ hasText: "can't find a registered team" }),
    ).toBeVisible();
  });

  await test.step("the team reorders, reviews and submits", async () => {
    const items = team.getByTestId("ranking").getByRole("listitem");
    const last = ((await items.nth(3).locator("span").nth(1).textContent()) ?? "").trim();
    await team.getByRole("button", { name: `Move ${last} up` }).click();
    await team.getByRole("button", { name: `Move ${last} up` }).click();
    await team.getByRole("button", { name: `Move ${last} up` }).click();
    await expect(items.nth(0)).toContainText(last);
    await team.getByLabel("Team reference").fill(a.reference.toLowerCase());
    await team.getByRole("button", { name: "Review our choices" }).click();
    await expect(team.getByRole("heading", { name: "Check your choices" })).toBeFocused();
    await expect(team.getByTestId("review-order").getByRole("listitem").nth(0)).toContainText(last);
    await expect(team.getByText("can submit only once")).toBeVisible();
    await expectAccessible(team);
    await team.getByRole("button", { name: "Submit our choices" }).click();
    await expect(team.getByRole("heading", { name: "Your team's choices are in." })).toBeFocused();
    await expect(team.getByTestId("done-reference")).toHaveText(a.reference);
    await expect(team.getByTestId("done-time")).toHaveText(/\d{2}:\d{2}:\d{2}/);
    await expectAccessible(team);
  });

  await test.step("a second submit from the same team changes nothing", async () => {
    await team.goto("/statements");
    await team.getByLabel("Team reference").fill(a.reference);
    await team.getByRole("button", { name: "Review our choices" }).click();
    await team.getByRole("button", { name: "Submit our choices" }).click();
    await expect(
      team.getByRole("heading", { name: "Your team already has an entry." }),
    ).toBeVisible();
  });

  await test.step("organizer closes selection and assigns the team that didn't submit", async () => {
    await page.reload();
    await confirmAndPress(page, /Close selection now/, "Close selection");
    await expect(page.getByRole("status")).toContainText("Selection is closed");
    await team.goto("/statements");
    await expect(team.getByRole("heading", { name: "Selection has closed" })).toBeVisible();

    const select = page.getByLabel(`Statement for ${b.reference}`);
    await expect(select).toBeVisible();
    await page
      .getByRole("listitem")
      .filter({ has: select })
      .getByRole("button", { name: "Assign" })
      .click();
    await expect(page.getByRole("status")).toContainText("Statement assigned");
  });

  await test.step("results appear only after Publish, and go away on Unpublish", async () => {
    await team.goto("/statements/results");
    await expect(team.getByRole("heading", { name: "Results aren't out yet" })).toBeVisible();

    await confirmAndPress(page, /Publish every team's statement/, "Publish results");
    await expect(page.getByRole("status")).toContainText("Results are published");
    await team.goto("/statements/results");
    await expect(team.getByTestId("results")).toContainText(a.reference);
    await expect(team.getByTestId("results")).toContainText(b.reference);
    await expect(team.getByTestId("results")).not.toContainText(b.name);

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download choices (CSV)" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^finforge-2027-statement-choices-.*\.csv$/);

    await page.getByRole("button", { name: "Unpublish results" }).click();
    await expect(page.getByRole("status")).toContainText("hidden");
    await team.goto("/statements/results");
    await expect(team.getByRole("heading", { name: "Results aren't out yet" })).toBeVisible();
  });

  expect(errors).toEqual([]);
});
