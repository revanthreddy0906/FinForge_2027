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

function whenIdle(run: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 2000);
  }
}

if (sharedSentryOptions.enabled) {
  if (document.readyState === "complete") {
    whenIdle(loadSentry);
  } else {
    window.addEventListener(
      "load",
      () => {
        whenIdle(loadSentry);
      },
      { once: true },
    );
  }
}
