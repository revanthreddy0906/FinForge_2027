import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error monitoring. Runs once per server instance. Only the Node.js runtime is
 * used (no Edge routes), and Sentry stays off outside Vercel production (see
 * `src/lib/monitoring/sentry-options.ts`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { sharedSentryOptions } = await import("@/lib/monitoring/sentry-options");
    Sentry.init({
      ...sharedSentryOptions,
      // Handled server failures (a payment that can't start, a database error) are logged with
      // console.error and never thrown, so report those too. The log lines carry only error
      // codes, and beforeSend strips anything else.
      integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    });
  }
}

/** Reports errors thrown while rendering pages, in server actions and in route handlers. */
export const onRequestError = Sentry.captureRequestError;
