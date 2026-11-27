/**
 * Shared Sentry settings for the server and the browser.
 *
 * Sentry only runs in the Vercel production environment, so previews, e2e runs, load tests and
 * ZAP scans never send events or trigger alerts. Errors only: no tracing, replays or feedback
 * widgets, which keeps the browser bundle small and collects no browsing data.
 */
import { scrubBreadcrumb, scrubEvent } from "./scrub";

/** The DSN is public by design: it can only send events, never read them. */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

/** "production" | "preview" | "development". Vercel exposes the NEXT_PUBLIC_ copy to the browser. */
export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development";

export function sentryEnabled(dsn = SENTRY_DSN, environment = SENTRY_ENVIRONMENT): boolean {
  return dsn !== "" && environment === "production";
}

/** The ingest origin of the DSN, for the CSP's connect-src. Null when no valid DSN is set. */
export function sentryIngestOrigin(dsn = SENTRY_DSN): string | null {
  if (dsn === "") return null;
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export const sharedSentryOptions = {
  dsn: SENTRY_DSN,
  environment: SENTRY_ENVIRONMENT,
  enabled: sentryEnabled(),
  sendDefaultPii: false,
  // No performance tracing (undefined disables it; 0 would still create spans).
  tracesSampleRate: undefined,
  maxBreadcrumbs: 30,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
