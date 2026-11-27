import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { maskText, scrubBreadcrumb, scrubEvent } from "./scrub";
import { sentryEnabled, sentryIngestOrigin } from "./sentry-options";

// Made-up values that look like what the site handles.
const EMAIL = "leader@example.com";
const PHONE = "+91 98765 43210";
const SHARE = "FAKESHARETOKEN000000000000000000";
const COOKIE = "FAKECOOKIEVALUE";
const IP = "203.0.113.9";

function dirtyEvent(): ErrorEvent {
  return {
    type: undefined,
    message: `Could not save ${EMAIL}`,
    user: { email: EMAIL, ip_address: IP },
    server_name: "host-1",
    extra: { form: { email: EMAIL } },
    request: {
      url: `https://example.com/admin?_vercel_share=${SHARE}`,
      cookies: { "sb-admin-access": COOKIE },
      headers: { "x-forwarded-for": IP, authorization: "Bearer FAKEBEARER" },
      data: { leaderEmail: EMAIL, leaderMobile: PHONE },
      query_string: `_vercel_share=${SHARE}`,
    },
    exception: {
      values: [
        {
          type: "Error",
          value: `duplicate key for ${EMAIL} / ${PHONE}`,
          stacktrace: { frames: [{ filename: "app.js", vars: { email: EMAIL } }] },
        },
      ],
    },
    breadcrumbs: [
      { category: "console", message: `logged ${EMAIL}` },
      {
        category: "fetch",
        data: {
          url: `/api/x?token=FAKETOKEN&email=${EMAIL}`,
          method: "POST",
          status_code: 500,
          body: EMAIL,
        },
      },
      {
        category: "navigation",
        data: { from: "/", to: "/statements?ref=FF27-0001&team_code=FAKECODE" },
      },
    ],
    contexts: { runtime: { name: "node" }, custom: { email: EMAIL } },
  };
}

describe("scrubEvent", () => {
  it("removes every email, phone number, cookie, header and token", () => {
    const out = JSON.stringify(scrubEvent(dirtyEvent()));
    for (const value of [
      EMAIL,
      "98765",
      SHARE,
      COOKIE,
      "FAKEBEARER",
      IP,
      "FAKECODE",
      "FAKETOKEN",
    ]) {
      expect(out).not.toContain(value);
    }
  });

  it("keeps what is needed to find the bug", () => {
    const event = scrubEvent(dirtyEvent());
    expect(event.exception?.values?.[0]?.type).toBe("Error");
    expect(event.exception?.values?.[0]?.value).toBe("duplicate key for [email] / [number]");
    expect(event.request?.url).toBe("https://example.com/admin");
    expect(event.contexts).toMatchObject({ runtime: { name: "node" } });
    expect(event.breadcrumbs?.map((b) => b.category)).toEqual(["fetch", "navigation"]);
    expect(event.breadcrumbs?.[0]?.data).toEqual({
      url: "/api/x",
      method: "POST",
      status_code: 500,
    });
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs", () => {
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
  });
});

describe("maskText", () => {
  it("masks Indian mobile numbers in common formats", () => {
    for (const n of ["9876543210", "+919876543210", "+91 98765 43210", "98765-43210"]) {
      expect(maskText(`call ${n}`)).toBe("call [number]");
    }
  });
});

describe("sentry options", () => {
  it("runs only in production with a DSN", () => {
    expect(sentryEnabled("https://k@o1.ingest.sentry.io/1", "production")).toBe(true);
    expect(sentryEnabled("https://k@o1.ingest.sentry.io/1", "preview")).toBe(false);
    expect(sentryEnabled("", "production")).toBe(false);
  });

  it("reads the ingest origin from the DSN", () => {
    expect(sentryIngestOrigin("https://k@o1.ingest.us.sentry.io/45")).toBe(
      "https://o1.ingest.us.sentry.io",
    );
    expect(sentryIngestOrigin("not a url")).toBeNull();
    expect(sentryIngestOrigin("")).toBeNull();
  });
});
