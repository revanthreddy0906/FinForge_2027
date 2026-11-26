import "server-only";
import { groupTeams, type OrphanPayment, type TeamSummary } from "@/lib/admin/registrations";
import { dataClientFor } from "./admin-session";

export type ConsoleData =
  | { ok: true; organizer: true; teams: TeamSummary[]; refunds: OrphanPayment[]; loadedAt: number }
  | { ok: true; organizer: false }
  | { ok: false };

/**
 * Reads registrations as the signed-in organizer. Row Level Security decides access: a token
 * that isn't an allow-listed organizer at aal2 gets no rows, whatever this code does.
 */
export async function loadConsoleData(accessToken: string): Promise<ConsoleData> {
  const db = dataClientFor(accessToken);
  const admin = await db.rpc("current_user_is_admin");
  if (admin.error) {
    console.error("[admin] organizer check failed", { code: admin.error.code });
    return { ok: false };
  }
  if (!admin.data) return { ok: true, organizer: false };

  const { data, error } = await db
    .from("admin_registrations")
    .select(
      "reference, team_name, institution, status, leader_phone, registered_at, position, is_leader, full_name, email, payment_state, amount_paise, razorpay_payment_id, paid_at",
    )
    .order("registered_at", { ascending: true })
    .order("position", { ascending: true })
    .limit(5000);
  if (error) {
    console.error("[admin] registrations read failed", { code: error.code });
    return { ok: false };
  }

  // Paid after the team's hold ran out and the team was released: these need a refund.
  const orphans = await db
    .from("payments")
    .select("team_reference, team_name, amount_paise, razorpay_payment_id, paid_at")
    .is("team_id", null)
    .eq("status", "paid")
    .order("paid_at", { ascending: true })
    .limit(500);
  if (orphans.error) {
    console.error("[admin] payments read failed", { code: orphans.error.code });
    return { ok: false };
  }
  return {
    ok: true,
    organizer: true,
    teams: groupTeams(data),
    refunds: orphans.data,
    loadedAt: Date.now(),
  };
}
