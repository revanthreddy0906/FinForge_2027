/** The Turnstile action the registration form sends; the server rejects tokens for any other. */
export const TURNSTILE_ACTION = "register";

export interface SiteverifyResult {
  success: boolean;
  action?: string | undefined;
  hostname?: string | undefined;
  errorCodes: readonly string[];
}

/**
 * Parses `TURNSTILE_HOSTNAMES` ("a.example, b.example") into the set of frontend hostnames a
 * token may come from. Empty means the hostname and action checks are off (local and e2e runs,
 * which use Cloudflare's test keys).
 */
export function parseHostnames(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Decides whether a siteverify answer lets the request through. Returns null when it does, or a
 * short reason (safe to log: no token, no personal data) when it doesn't.
 */
export function rejectReason(
  result: SiteverifyResult,
  hostnames: ReadonlySet<string>,
): string | null {
  if (!result.success) {
    return `verification failed: ${result.errorCodes.length ? result.errorCodes.join(",") : "none"}`;
  }
  if (hostnames.size === 0) return null;
  if (result.action !== TURNSTILE_ACTION) return `unexpected action: ${result.action ?? "none"}`;
  if (!result.hostname || !hostnames.has(result.hostname.toLowerCase())) {
    return `unexpected hostname: ${result.hostname ?? "none"}`;
  }
  return null;
}
