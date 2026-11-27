/**
 * PostHog product analytics: settings, the on/off gate and the privacy filter.
 *
 * PostHog only runs in the Vercel production environment, like Sentry, so previews, e2e runs,
 * load tests and ZAP scans never send events. It runs cookieless (no cookies or storage, no
 * consent banner needed), never identifies anyone, never records sessions, and every event
 * passes through `scrubPostHogEvent` so no name, email, phone number or URL token leaves the
 * browser. See docs/analytics.md.
 */
import type { CaptureResult, PostHogConfig } from "posthog-js";
import { maskText, maskUrl } from "@/lib/monitoring/scrub";
import { POSTHOG_KEY, POSTHOG_PROXY_PATH, POSTHOG_UI_HOST } from "./posthog-hosts";

export { POSTHOG_KEY };

/**
 * On in Vercel production only. `NEXT_PUBLIC_POSTHOG_LOCAL_TEST=1` turns it on for a local
 * production build (to check the CSP and payloads), and is ignored on any Vercel deployment.
 */
export function posthogEnabled(
  key = POSTHOG_KEY,
  vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV,
  localTest = process.env.NEXT_PUBLIC_POSTHOG_LOCAL_TEST === "1",
): boolean {
  if (key === "") return false;
  if (vercelEnv === "production") return true;
  return localTest && vercelEnv === undefined;
}

/** The organizer console is never tracked. */
export function isUntrackedPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export interface PrivacySignals {
  doNotTrack: string | null | undefined;
  globalPrivacyControl: boolean | undefined;
  pathname: string;
}

/** Do Not Track or Global Privacy Control means the SDK is never even downloaded. */
export function trackingAllowed({
  doNotTrack,
  globalPrivacyControl,
  pathname,
}: PrivacySignals): boolean {
  if (doNotTrack === "1" || doNotTrack === "yes") return false;
  if (globalPrivacyControl === true) return false;
  return !isUntrackedPath(pathname);
}

/** Ids PostHog needs intact; masking could mangle them and they hold no personal data. */
const ID_PROPERTIES = new Set([
  "token",
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
  "$insert_id",
  "$pageview_id",
  "$prev_pageview_id",
  "$lib",
  "$lib_version",
  "$config_defaults",
]);

function pathOf(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return new URL(url, "https://example.invalid").pathname;
  } catch {
    return null;
  }
}

function looksLikeUrl(value: string): boolean {
  return /^(?:https?:\/\/|\/)/i.test(value);
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    // URLs lose their query string and fragment (tokens, Razorpay ids, form values).
    return looksLikeUrl(value) ? maskUrl(value) : maskText(value);
  }
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubValue(v)]),
    );
  }
  return value;
}

/**
 * Last stop before an event leaves the browser. Drops anything from the organizer console and
 * masks every string property (emails, phone numbers, URL query strings). Returning null drops
 * the event.
 */
export function scrubPostHogEvent(event: CaptureResult | null): CaptureResult | null {
  if (event === null) return null;
  const path = pathOf(event.properties.$current_url) ?? pathOf(event.properties.$pathname);
  if (path !== null && isUntrackedPath(path)) return null;

  const properties = Object.fromEntries(
    Object.entries(event.properties as Record<string, unknown>).map(([key, value]) => [
      key,
      ID_PROPERTIES.has(key) ? value : scrubValue(value),
    ]),
  );
  // Person properties are never set (nobody is identified), so anything here is unexpected.
  const scrubbed: CaptureResult = { ...event, properties };
  delete scrubbed.$set;
  delete scrubbed.$set_once;
  return scrubbed;
}

/**
 * Pinned so an SDK upgrade can't switch new behaviour on silently. Everything beyond pageviews,
 * clicks and our own funnel events is off; Sentry covers errors and Speed Insights covers
 * performance.
 */
export const posthogConfig: Partial<PostHogConfig> = {
  api_host: POSTHOG_PROXY_PATH,
  ui_host: POSTHOG_UI_HOST,
  defaults: "2026-08-30",
  cookieless_mode: "always",
  person_profiles: "identified_only",
  respect_dnt: true,
  // App Router navigations change the URL without a page load.
  capture_pageview: "history_change",
  capture_pageleave: "if_capture_pageview",
  // Clicks only, with no element text or attributes and never a field's value.
  autocapture: { dom_event_allowlist: ["click"], capture_copied_text: false },
  mask_all_text: true,
  mask_all_element_attributes: true,
  mask_personal_data_properties: true,
  rageclick: true,
  capture_dead_clicks: false,
  capture_heatmaps: false,
  capture_exceptions: false,
  capture_performance: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_product_tours: true,
  disable_conversations: true,
  disable_web_experiments: true,
  // No toolbar, recorder or survey scripts from PostHog's CDN, so the CSP stays unchanged.
  disable_external_dependency_loading: true,
  // No feature flags, so no /flags request.
  advanced_disable_flags: true,
  before_send: scrubPostHogEvent,
};
