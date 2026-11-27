import "server-only";
import { NextResponse } from "next/server";
import type { SelectionTeam } from "@/lib/admin/selection";
import { loadSelectionConsole } from "./admin-statements";
import { requireConsole } from "./require-console";

/** A CSV download for the selection console, with the same access rules as the console page. */
export async function selectionCsvResponse(
  from: "/admin/statements/export",
  name: string,
  build: (teams: readonly SelectionTeam[]) => string,
): Promise<NextResponse> {
  const { accessToken } = await requireConsole(from);
  const data = await loadSelectionConsole(accessToken);
  if (!data.ok || !data.organizer) {
    return new NextResponse(
      data.ok ? "This account isn't an organizer." : "The selection couldn't load. Try again.",
      {
        status: data.ok ? 403 : 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new NextResponse(build(data.teams), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finforge-2027-${name}-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
