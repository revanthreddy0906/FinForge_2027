import "server-only";
import type { DbErrorCode, SaveOutcome } from "@/lib/registration/register";
import type { toRegisterTeamPayload } from "@/lib/registration/schema";
import { supabaseAdmin } from "./supabase-admin";

const knownCodes = new Set<string>([
  "invalid_input",
  "invalid_team_size",
  "duplicate_member_email",
  "team_name_taken",
  "email_taken",
  "team_name_held",
  "email_held",
  "event_full",
]);

function isDbErrorCode(code: string): code is DbErrorCode {
  return knownCodes.has(code);
}

/** Calls public.register_team and maps its result. Unknown failures become "unavailable". */
export async function saveTeam(
  payload: ReturnType<typeof toRegisterTeamPayload>,
): Promise<SaveOutcome> {
  const { data, error } = await supabaseAdmin().rpc("register_team", { payload });
  if (error) {
    if (error.code === "P0001" && isDbErrorCode(error.message)) {
      return { ok: false, code: error.message, detail: error.details || undefined };
    }
    console.error("register_team failed", { code: error.code });
    return { ok: false, code: "unavailable" };
  }
  const row = data[0];
  if (!row) return { ok: false, code: "unavailable" };
  return { ok: true, teamId: row.team_id, reference: row.reference, created: row.created };
}
