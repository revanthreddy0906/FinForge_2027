import { startAnalytics } from "@/lib/analytics/track";
import { afterLoadWhenIdle } from "@/lib/browser/when-idle";
import { sharedSentryOptions } from "@/lib/monitoring/sentry-options";

/**
 * Browser error monitoring: uncaught errors and unhandled promise rejections, errors only.
 *
 * The Sentry SDK (about 50 KB gzipped) loads after the page has finished loading and the main
 * thread is idle, so it never delays the first paint or hydration on slow phones. Errors thrown
 * before then are not reported; server errors are always reported by `src/instrumentation.ts`.
 * Outside Vercel production the SDK is never downloaded.
 */
function loadSentry() {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      ...sharedSentryOptions,
      // No per-visit session pings: only errors are sent.
      integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserSession"),
    });
  });
}

if (sharedSentryOptions.enabled) {
  afterLoadWhenIdle(loadSentry);
}

// Product analytics (PostHog), also production only and loaded when idle. See docs/analytics.md.
startAnalytics();
