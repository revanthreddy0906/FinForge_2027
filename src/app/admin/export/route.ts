import { NextResponse } from "next/server";
import { registrationsCsv } from "@/lib/admin/registrations";
import { loadConsoleData } from "@/lib/server/admin-data";
import { requireConsole } from "@/lib/server/require-console";

/** CSV of every registered member. Same access rules as the console page. */
export async function GET() {
  const { accessToken } = await requireConsole("/admin/export");
  const data = await loadConsoleData(accessToken);
  if (!data.ok || !data.organizer) {
    return new NextResponse(
      data.ok ? "This account isn't an organizer." : "Registrations couldn't load. Try again.",
      {
        status: data.ok ? 403 : 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new NextResponse(registrationsCsv(data.teams), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finforge-2027-registrations-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
