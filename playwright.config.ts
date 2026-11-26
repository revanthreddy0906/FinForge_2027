import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests run against a production build with registration forced open.
 * Turnstile uses Cloudflare's always-pass test keys. The database-backed flow
 * (e2e/register-flow.spec.ts) runs only when E2E_SUPABASE_URL and E2E_SUPABASE_SECRET_KEY point
 * at the staging project, never production.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${String(PORT)}`,
    port: PORT,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_REGISTRATION_STATE: "open",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:9/unreachable",
      SUPABASE_SECRET_KEY: process.env.E2E_SUPABASE_SECRET_KEY ?? "e2e-no-database-configured",
      FINFORGE_ALLOW_MEMORY_RATE_LIMIT: "1",
    },
  },
});
