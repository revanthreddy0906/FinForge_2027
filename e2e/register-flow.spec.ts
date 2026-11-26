import { expect, fillTeam, setCheckoutMode, test } from "./fixtures";

/**
 * Full flow against the staging database (projects "*-staging-db" in playwright.config.ts,
 * which exist only when the staging secrets are set). Razorpay is the local stand-in
 * (e2e/razorpay-stub.mjs) and a fake checkout.js (fixtures.ts). Leaves test rows in staging;
 * clean them up with supabase/tests/cleanup_staging.sql.
 */
test.describe.configure({ mode: "serial" });

const run = `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
const team = {
  teamName: `E2E Hawks ${run}`,
  college: "CBIT",
  phone: "98765 43210",
  members: [
    { name: "Asha Rao", email: `asha-${run}@example.com` },
    { name: "Vik Reddy", email: `vik-${run}@example.com` },
    { name: "Sam K", email: `sam-${run}@example.com` },
  ],
};

test("registers a team, takes the fee for 3 members and confirms it", async ({ page }) => {
  await page.goto("/register");
  await fillTeam(page, team);
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByRole("heading", { name: /^Pay ₹2,097 to confirm/ })).toBeFocused();
  await expect(page.getByTestId("payment-amount")).toHaveText("₹2,097");
  await expect(page.getByTestId("payment-step")).toContainText("3 × ₹699 per member");

  await page.getByRole("button", { name: "Pay ₹2,097" }).click();
  await expect(page.getByRole("heading", { name: `${team.teamName} is in.` })).toBeFocused();
  await expect(page.getByTestId("team-reference")).toHaveText(/^FF27-\d{4,}$/);
});

test("a cancelled or failed payment keeps the team and lets them pay again", async ({ page }) => {
  const name = `E2E Retry ${run}`;
  await page.goto("/register");
  await fillTeam(page, {
    ...team,
    teamName: name,
    members: [
      { name: "Rita Rao", email: `rita-${run}@example.com` },
      { name: "Om Das", email: `om-${run}@example.com` },
    ],
  });
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByTestId("payment-amount")).toHaveText("₹1,398");

  await setCheckoutMode(page, "dismiss");
  await page.getByRole("button", { name: "Pay ₹1,398" }).click();
  await expect(page.getByRole("status")).toContainText("Payment cancelled");

  await setCheckoutMode(page, "fail");
  await page.getByRole("button", { name: "Pay ₹1,398" }).click();
  await expect(page.getByRole("status")).toContainText("didn't go through");

  // A reload keeps the pending team for this tab: submitting again resumes its payment.
  await page.reload();
  await fillTeam(page, {
    ...team,
    teamName: name,
    members: [
      { name: "Rita Rao", email: `rita-${run}@example.com` },
      { name: "Om Das", email: `om-${run}@example.com` },
    ],
  });
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByTestId("payment-amount")).toHaveText("₹1,398");

  await setCheckoutMode(page, "pay");
  await page.getByRole("button", { name: "Pay ₹1,398" }).click();
  await expect(page.getByRole("heading", { name: `${name} is in.` })).toBeVisible();
});

test("an unpaid team holds its name for others", async ({ page }) => {
  const name = `E2E Hold ${run}`;
  await page.goto("/register");
  await fillTeam(page, {
    ...team,
    teamName: name,
    members: [
      { name: "Hari P", email: `hari-${run}@example.com` },
      { name: "Uma S", email: `uma-${run}@example.com` },
    ],
  });
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByTestId("payment-step")).toBeVisible();

  // Someone else (a fresh tab, so no saved pending key) tries the same name while it's unpaid.
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.reload();
  await fillTeam(page, {
    ...team,
    teamName: name.toUpperCase(),
    members: [
      { name: "Other Lead", email: `other-lead-${run}@example.com` },
      { name: "Other Mate", email: `other-mate-${run}@example.com` },
    ],
  });
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.locator("#form-errors")).toContainText("waiting to pay");
});

test("rejects the same team name and a member already in a team", async ({ page }) => {
  await page.goto("/register");
  await fillTeam(page, {
    ...team,
    teamName: team.teamName.toUpperCase(),
    members: [
      { name: "New Leader", email: `new-${run}@example.com` },
      { name: "New Member", email: `other-${run}@example.com` },
    ],
  });
  await page.getByRole("button", { name: "Register team" }).click();
  // Next.js adds its own role="alert" route announcer, so target the form's summary.
  await expect(page.locator("#form-errors")).toContainText("Another team already has this name");

  await page.getByLabel("Team name").fill(`Fresh ${run}`);
  await page.locator("#f-members-1-email").fill(team.members[2]?.email ?? "");
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.locator("#f-members-1-email-error")).toContainText(
    "use a different email for member 2",
  );
  await expect(page.locator("#form-errors")).toContainText("Member 2:");
});
