import { defineConfig, devices } from "@playwright/test";

const NO_DB_PORT = 3100;
const DB_PORT = 3101;

/** Shared by both servers: registration forced open, Cloudflare's always-pass Turnstile keys. */
const baseEnv = {
  NEXT_PUBLIC_REGISTRATION_STATE: "open",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  FINFORGE_ALLOW_MEMORY_RATE_LIMIT: "1",
};

const stagingUrl = process.env.E2E_SUPABASE_URL;
const stagingKey = process.env.E2E_SUPABASE_SECRET_KEY;
const hasStaging = Boolean(stagingUrl && stagingKey);

const desktop = devices["Desktop Chrome"];
const mobile = { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } };

/**
 * One production build, two servers:
 * - port 3100 has no database, for page, validation, error-recovery and rate-limit tests;
 * - port 3101 uses the STAGING database (never production) for the real registration flow.
 *   It only starts when E2E_SUPABASE_URL and E2E_SUPABASE_SECRET_KEY are set.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "off" },
  projects: [
    {
      name: "desktop",
      testMatch: /(register-form|security-headers)\.spec\.ts/,
      use: { ...desktop, baseURL: `http://localhost:${String(NO_DB_PORT)}` },
    },
    {
      name: "mobile",
      testMatch: /(register-form|security-headers)\.spec\.ts/,
      use: { ...mobile, baseURL: `http://localhost:${String(NO_DB_PORT)}` },
    },
    ...(hasStaging
      ? [
          {
            name: "desktop-staging-db",
            testMatch: /register-flow\.spec\.ts/,
            use: { ...desktop, baseURL: `http://localhost:${String(DB_PORT)}` },
          },
          {
            name: "mobile-staging-db",
            testMatch: /register-flow\.spec\.ts/,
            use: { ...mobile, baseURL: `http://localhost:${String(DB_PORT)}` },
          },
        ]
      : []),
  ],
  // Playwright starts these in order, so the second server reuses the first one's build.
  webServer: [
    {
      command: `npm run build && npx next start -p ${String(NO_DB_PORT)}`,
      port: NO_DB_PORT,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...baseEnv,
        SUPABASE_URL: "http://127.0.0.1:9/no-database",
        SUPABASE_SECRET_KEY: "e2e-no-database-configured",
      },
    },
    ...(hasStaging
      ? [
          {
            command: `npx next start -p ${String(DB_PORT)}`,
            port: DB_PORT,
            timeout: 60_000,
            reuseExistingServer: !process.env.CI,
            env: {
              ...baseEnv,
              SUPABASE_URL: stagingUrl ?? "",
              SUPABASE_SECRET_KEY: stagingKey ?? "",
            },
          },
        ]
      : []),
  ],
});
