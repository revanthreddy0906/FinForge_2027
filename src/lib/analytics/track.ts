/**
 * Product analytics in the browser: starts PostHog after the page is idle and sends our own
 * registration funnel events. Outside production, or with Do Not Track / Global Privacy Control
 * on, or on /admin, nothing is downloaded and `track` does nothing.
 *
 * Event properties are counts and fixed codes only. Never pass a name, email, phone number,
 * team name or reference here.
 */
import type { PostHog } from "posthog-js";
import { afterLoadWhenIdle } from "@/lib/browser/when-idle";
import { POSTHOG_KEY, posthogConfig, posthogEnabled, trackingAllowed } from "./posthog-options";

export type FunnelEvent =
  | "registration_form_started"
  | "registration_form_invalid"
  | "registration_submitted"
  | "registration_server_error"
  | "registration_payment_shown"
  | "registration_payment_opened"
  | "registration_payment_problem"
  | "registration_completed";

export type FunnelProperties = Readonly<Record<string, number | boolean>>;

/** Events sent before the SDK has loaded wait here (a fast submit on a slow phone). */
const MAX_QUEUED = 50;
const queue: [FunnelEvent, FunnelProperties | undefined][] = [];
let client: PostHog | null = null;
let state: "off" | "loading" | "ready" = "off";

export function track(event: FunnelEvent, properties?: FunnelProperties): void {
  if (state === "off") return;
  if (client) {
    client.capture(event, properties);
  } else if (queue.length < MAX_QUEUED) {
    queue.push([event, properties]);
  }
}

function load(): void {
  void import("posthog-js/no-external")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, posthogConfig);
      client = posthog;
      state = "ready";
      for (const [event, properties] of queue.splice(0)) posthog.capture(event, properties);
    })
    .catch(() => {
      // Blocked or offline: analytics is optional, so give up quietly.
      state = "off";
      queue.length = 0;
    });
}

/** Called once from src/instrumentation-client.ts. */
export function startAnalytics(): void {
  if (state !== "off" || !posthogEnabled()) return;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const allowed = trackingAllowed({
    doNotTrack: nav.doNotTrack,
    globalPrivacyControl: nav.globalPrivacyControl,
    pathname: window.location.pathname,
  });
  if (!allowed) return;
  state = "loading";
  afterLoadWhenIdle(load);
}
