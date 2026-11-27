/**
 * Strips personal data from Sentry events before they leave the server or the browser.
 *
 * Registration forms carry names, emails and mobile numbers, the organizer console carries
 * session cookies, and share links carry access tokens. None of that may reach Sentry, so
 * events keep only what is needed to find a bug: the error, the stack, the route and the
 * release. Free text (messages, exception values, breadcrumbs) is masked as well, in case an
 * error message quotes user input.
 */
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Indian mobile numbers with or without +91, spaces or dashes; also any long digit run.
const PHONE = /(?:\+91|\b91)[\s-]?[6-9]\d{4}[\s-]?\d{5}\b|\b[6-9]\d{4}[\s-]?\d{5}\b|\b\d{10,}\b/g;
// Tokens that may sit in a URL: share links, Supabase auth codes, Razorpay ids.
const SECRET_PARAM =
  /([?&](?:_vercel_share|x-vercel-protection-bypass|code|token|access_token|refresh_token|razorpay_[a-z_]+|ref|team_code)=)[^&#\s]*/gi;

/** Masks emails, phone numbers and secret URL parameters in a piece of text. */
export function maskText(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[number]")
    .replace(SECRET_PARAM, "$1[redacted]");
}

export function maskUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  // Keep only origin and path: query strings and fragments can carry tokens or form values.
  const cut = url.search(/[?#]/);
  return maskText(cut === -1 ? url : url.slice(0, cut));
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.server_name;
  delete event.extra;

  if (event.request) {
    // Cookies hold the organizer session; bodies hold form data; headers hold IPs and tokens.
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
    delete event.request.env;
    event.request.url = maskUrl(event.request.url);
  }

  if (event.message) event.message = maskText(event.message);
  if (event.logentry?.message) event.logentry.message = maskText(event.logentry.message);
  if (event.logentry?.params) delete event.logentry.params;

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = maskText(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) {
      // Local variables can hold anything the code had in scope.
      delete frame.vars;
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((b): b is Breadcrumb => b !== null);
  }

  if (event.contexts) {
    // Keep runtime, OS and browser contexts; drop anything custom code may have attached.
    const { runtime, os, browser, trace, nextjs } = event.contexts;
    event.contexts = { runtime, os, browser, trace, nextjs };
  }

  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console output and form input breadcrumbs can echo user data; navigation and fetch
  // breadcrumbs are useful once their URLs are cut down.
  if (breadcrumb.category === "console" || breadcrumb.category === "ui.input") return null;

  const scrubbed: Breadcrumb = { ...breadcrumb };
  if (scrubbed.message) scrubbed.message = maskText(scrubbed.message);
  if (scrubbed.data) {
    // Keep only these fields; URLs lose their query strings.
    const { url, from, to, method, status_code: statusCode } = scrubbed.data;
    const data: Record<string, unknown> = {};
    if (typeof url === "string") data.url = maskUrl(url);
    if (typeof from === "string") data.from = maskUrl(from);
    if (typeof to === "string") data.to = maskUrl(to);
    if (typeof method === "string") data.method = method;
    if (typeof statusCode === "number") data.status_code = statusCode;
    scrubbed.data = data;
  }
  return scrubbed;
}
