/**
 * Where PostHog events go. No imports, so next.config.ts can read it too: events go to our own
 * origin (/ingest) and Next rewrites them to PostHog's US region.
 */

/** The project API key is public by design: it can only send events, never read them. */
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

export const POSTHOG_PROXY_PATH = "/ingest";
export const POSTHOG_INGEST_ORIGIN = "https://us.i.posthog.com";
export const POSTHOG_UI_HOST = "https://us.posthog.com";
