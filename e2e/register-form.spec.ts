import AxeBuilder from "@axe-core/playwright";
import { expect, fillTeam, test } from "./fixtures";

const team = {
  teamName: "Ledger Hawks",
  college: "CBIT",
  phone: "98765 43210",
  members: [
    { name: "Asha Rao", email: "asha@example.com" },
    { name: "Vik Reddy", email: "vik@example.com" },
  ],
};

test.describe("registration page", () => {
  test("loads cleanly, is accessible and fits the screen", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/register");
    await expect(page.getByRole("heading", { level: 1, name: "Register your team" })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByText("Registrations open")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("an empty submit lists every problem and focuses the first field", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Register team" }).click();
    const alert = page.locator("#form-errors");
    await expect(alert).toContainText("Some details need fixing");
    await expect(alert.getByRole("link")).toHaveCount(8);
    await expect(page.getByLabel("Team name")).toBeFocused();
    await expect(page.getByLabel("Team name")).toHaveAttribute("aria-invalid", "true");

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
  });

  test("checks phone numbers and repeated emails as you go", async ({ page }) => {
    await page.goto("/register");
    const phone = page.getByLabel("Mobile number");
    await phone.fill("12345");
    await phone.blur();
    await expect(page.getByText("Enter a 10-digit Indian mobile number")).toBeVisible();
    await phone.fill("+91 98765-43210");
    await expect(page.getByText("Enter a 10-digit Indian mobile number")).toHaveCount(0);

    await page.locator("#f-members-0-email").fill("asha@example.com");
    const second = page.locator("#f-members-1-email");
    await second.fill("ASHA@example.com");
    await second.blur();
    await expect(page.getByText(/already used for the team leader/)).toBeVisible();
  });

  test("allows 2 to 5 members", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("button", { name: /Remove member/ })).toHaveCount(0);
    const add = page.getByRole("button", { name: /Add a member/ });
    // Each new member's name field takes focus; wait for it before the next click.
    for (const i of [2, 3, 4]) {
      await add.click();
      await expect(page.locator(`#f-members-${String(i)}-fullName`)).toBeFocused();
    }
    await expect(page.getByRole("button", { name: /Add a member/ })).toHaveCount(0);
    await expect(page.getByText("maximum of 5 members")).toBeVisible();
    await page.getByRole("button", { name: "Remove member 5" }).click();
    await page.getByRole("button", { name: "Remove member 4" }).click();
    await page.getByRole("button", { name: "Remove member 3" }).click();
    await expect(page.locator("#f-members-2-fullName")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Remove member/ })).toHaveCount(0);
  });

  test("keeps everything typed when the server can't save, and rate limits repeats", async ({
    page,
  }) => {
    test.setTimeout(90_000); // 21 submits to reach the limit
    await page.goto("/register");
    await fillTeam(page, team);
    const submit = page.getByRole("button", { name: "Register team" });

    const submitOnce = async () => {
      const response = page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/register",
      );
      await submit.click();
      await response;
      await expect(submit).toBeEnabled();
    };

    // This server has no database, so the server answers with an error.
    await submitOnce();
    const alert = page.locator("#form-errors");
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText("Too many attempts");
    await expect(page.getByLabel("Team name")).toHaveValue(team.teamName);
    await expect(page.locator("#f-members-1-email")).toHaveValue("vik@example.com");

    // 20 attempts per minute per IP: the 21st is refused.
    for (let i = 0; i < 19; i++) await submitOnce();
    await submitOnce();
    await expect(alert).toContainText("Too many attempts");
  });
});
