import { NextResponse, type NextRequest } from "next/server";
import { safeConsolePath } from "@/lib/admin/safe-next";
import { clearSession, refreshAdminSession } from "@/lib/server/admin-session";

/**
 * Refreshes an expired console session (access tokens last an hour), then sends the organizer
 * back where they were. Server Components can't set cookies, so pages redirect here instead.
 */
export async function GET(request: NextRequest) {
  const next = safeConsolePath(request.nextUrl.searchParams.get("next"));
  const ok = await refreshAdminSession().catch(() => false);
  if (!ok) await clearSession();
  const response = NextResponse.redirect(new URL(ok ? next : "/admin/login", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
