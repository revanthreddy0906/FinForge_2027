import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";
import {
  isUntrackedPath,
  posthogConfig,
  posthogEnabled,
  scrubPostHogEvent,
  trackingAllowed,
} from "./posthog-options";

// Made-up values that look like what the site handles.
const EMAIL = "leader@example.com";
const PHONE = "+91 98765 43210";

function event(properties: CaptureResult["properties"], name = "$autocapture"): CaptureResult {
  return { uuid: "0190a1b2-0000-7000-8000-000000000001", event: name, properties };
}

describe("posthogEnabled", () => {
  it("is on only in Vercel production with a key", () => {
    expect(posthogEnabled("phc_test", "production", false)).toBe(true);
    expect(posthogEnabled("", "production", false)).toBe(false);
    expect(posthogEnabled("phc_test", "preview", false)).toBe(false);
    expect(posthogEnabled("phc_test", "development", false)).toBe(false);
    expect(posthogEnabled("phc_test", undefined, false)).toBe(false);
  });

  it("allows a local production build to opt in, but never a Vercel preview", () => {
    expect(posthogEnabled("phc_test", undefined, true)).toBe(true);
    expect(posthogEnabled("phc_test", "preview", true)).toBe(false);
    expect(posthogEnabled("", undefined, true)).toBe(false);
  });
});

describe("trackingAllowed", () => {
  const open = { doNotTrack: null, globalPrivacyControl: undefined, pathname: "/" };

  it("respects Do Not Track and Global Privacy Control", () => {
    expect(trackingAllowed(open)).toBe(true);
    expect(trackingAllowed({ ...open, doNotTrack: "1" })).toBe(false);
    expect(trackingAllowed({ ...open, doNotTrack: "yes" })).toBe(false);
    expect(trackingAllowed({ ...open, globalPrivacyControl: true })).toBe(false);
    expect(trackingAllowed({ ...open, doNotTrack: "0" })).toBe(true);
  });

  it("never tracks the organizer console", () => {
    expect(trackingAllowed({ ...open, pathname: "/admin" })).toBe(false);
    expect(trackingAllowed({ ...open, pathname: "/admin/statements" })).toBe(false);
    expect(trackingAllowed({ ...open, pathname: "/administrator-faq" })).toBe(true);
    expect(isUntrackedPath("/register")).toBe(false);
  });
});

describe("scrubPostHogEvent", () => {
  it("drops events from the organizer console, even after a client navigation", () => {
    expect(scrubPostHogEvent(event({ $current_url: "https://site.test/admin/teams" }))).toBeNull();
    expect(scrubPostHogEvent(event({ $pathname: "/admin" }))).toBeNull();
    expect(scrubPostHogEvent(null)).toBeNull();
  });

  it("cuts query strings and fragments from URLs", () => {
    const out = scrubPostHogEvent(
      event({
        $current_url: "https://site.test/register?razorpay_payment_id=pay_X&email=a@b.co#top",
        $referrer: "https://www.google.com/search?q=finforge",
        $initial_current_url: "https://site.test/?_vercel_share=SECRET",
        $pathname: "/register",
      }),
    );
    expect(out?.properties).toMatchObject({
      $current_url: "https://site.test/register",
      $referrer: "https://www.google.com/search",
      $initial_current_url: "https://site.test/",
      $pathname: "/register",
    });
  });

  it("masks emails and phone numbers anywhere in the event, nested too", () => {
    const out = scrubPostHogEvent(
      event({
        $el_text: `Contact ${EMAIL}`,
        $elements_chain: `a:text="${PHONE}"`,
        nested: { list: [EMAIL, 3] },
      }),
    );
    const text = JSON.stringify(out);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain("98765");
    expect(out?.properties.nested).toEqual({ list: ["[email]", 3] });
  });

  it("keeps ids and numbers intact and drops person properties", () => {
    const input = {
      ...event({ distinct_id: "1234567890123", $session_id: "0190a1b2", member_count: 4 }),
      $set: { email: EMAIL },
      $set_once: { phone: PHONE },
    };
    const out = scrubPostHogEvent(input);
    expect(out?.properties).toMatchObject({
      distinct_id: "1234567890123",
      $session_id: "0190a1b2",
      member_count: 4,
    });
    expect(out).not.toHaveProperty("$set");
    expect(out).not.toHaveProperty("$set_once");
  });
});

describe("posthogConfig", () => {
  it("stays first-party, cookieless and off for replay, flags and remote scripts", () => {
    expect(posthogConfig).toMatchObject({
      api_host: "/ingest",
      cookieless_mode: "always",
      respect_dnt: true,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
    });
    expect(posthogConfig.defaults).not.toBe("latest");
  });
});
