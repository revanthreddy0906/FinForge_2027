import "server-only";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { adminEnv } from "./admin-env";

/**
 * Organizer sessions live in two httpOnly cookies scoped to /admin. No session data is ever
 * readable by browser JavaScript, and no Supabase key is sent to the browser.
 */
export const ACCESS_COOKIE = "ff27_admin_at";
export const REFRESH_COOKIE = "ff27_admin_rt";

/** A console session ends 12 hours after sign-in, even if it keeps refreshing. */
export const SESSION_MAX_AGE_S = 12 * 60 * 60;

/**
 * Seconds since the organizer last proved who they are. Supabase keeps the sign-in times in
 * the signed `amr` claim across refreshes, so this can't be extended by refreshing.
 */
export function signedInAgeSeconds(claims: { amr?: unknown }, nowS = Date.now() / 1000): number {
  const times = Array.isArray(claims.amr)
    ? claims.amr.flatMap((entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        "timestamp" in entry &&
        typeof entry.timestamp === "number"
          ? [entry.timestamp]
          : [],
      )
    : [];
  if (times.length === 0) return Number.POSITIVE_INFINITY;
  return nowS - Math.max(...times);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/admin",
    maxAge,
  };
}

export async function saveSession(session: Pick<Session, "access_token" | "refresh_token">) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, session.access_token, cookieOptions(SESSION_MAX_AGE_S));
  jar.set(REFRESH_COOKIE, session.refresh_token, cookieOptions(SESSION_MAX_AGE_S));
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, "", cookieOptions(0));
  jar.set(REFRESH_COOKIE, "", cookieOptions(0));
}

/** A fresh auth client per call, holding its session in memory only (never shared). */
export function authClient(): SupabaseClient<Database> {
  const env = adminEnv();
  const store = new Map<string, string>();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => {
          store.set(k, v);
        },
        removeItem: (k) => {
          store.delete(k);
        },
      },
    },
  });
}

/** Database client acting as the signed-in organizer, so RLS decides what it can read. */
export function dataClientFor(accessToken: string): SupabaseClient<Database> {
  const env = adminEnv();
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** An auth client loaded with the session from the cookies, or null when there is none. */
export async function authClientFromCookies(): Promise<SupabaseClient<Database> | null> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!access || !refresh) {
    console.warn("[admin] session cookies missing", { access: !!access, refresh: !!refresh });
    return null;
  }
  const client = authClient();
  const { data, error } = await client.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });
  if (error || !data.session) {
    console.warn("[admin] stored session rejected", { code: error?.code, status: error?.status });
    return null;
  }
  return client;
}

export type AdminSession =
  | { state: "signed-out" }
  /** The access token expired; /admin/session can refresh it. */
  | { state: "expired" }
  /** Password checked, authenticator code not yet. */
  | { state: "partial"; email: string }
  | { state: "verified"; email: string; accessToken: string };

/** Reads and verifies the organizer session from the cookies. */
export async function readAdminSession(): Promise<AdminSession> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (!access) return { state: "signed-out" };
  const { data, error } = await authClient().auth.getClaims(access);
  if (error || !data) {
    return jar.get(REFRESH_COOKIE)?.value ? { state: "expired" } : { state: "signed-out" };
  }
  if (signedInAgeSeconds(data.claims) > SESSION_MAX_AGE_S) return { state: "signed-out" };
  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  if (data.claims.aal !== "aal2") return { state: "partial", email };
  return { state: "verified", email, accessToken: access };
}

/** Swaps the refresh token for a new session. Returns false when the session is over. */
export async function refreshAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) return false;
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) return false;
  // The 12-hour limit is enforced from the token's amr claim in readAdminSession.
  await saveSession(data.session);
  return true;
}
