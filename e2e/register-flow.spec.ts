import { expect, fillTeam, test } from "./fixtures";

/**
 * Full flow against the staging database (projects "*-staging-db" in playwright.config.ts,
 * which exist only when the staging secrets are set). Leaves test rows in staging; clean them
 * up with supabase/tests/cleanup_staging.sql.
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

test("registers a team and shows its reference", async ({ page }) => {
  await page.goto("/register");
  await fillTeam(page, team);
  await page.getByRole("button", { name: "Register team" }).click();
  await expect(page.getByRole("heading", { name: `${team.teamName} is in.` })).toBeFocused();
  await expect(page.getByTestId("team-reference")).toHaveText(/^FF27-\d{4,}$/);
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
