import "server-only";
import {
  toSelectionTeam,
  type SelectionTeam,
  type SelectionTeamRow,
  type StatementSlots,
} from "@/lib/admin/selection";
import { dataClientFor } from "./admin-session";
import type { SelectionState } from "./statements";

export type SelectionConsole =
  | {
      ok: true;
      organizer: true;
      state: SelectionState;
      resultsPublished: boolean;
      slots: StatementSlots[];
      teams: SelectionTeam[];
    }
  | { ok: true; organizer: false }
  | { ok: false };

const states = new Set<string>(["not_open", "open", "closed"]);
const isState = (value: string): value is SelectionState => states.has(value);

/** Reads the selection as the signed-in organizer. RLS and private.is_admin() decide access. */
export async function loadSelectionConsole(accessToken: string): Promise<SelectionConsole> {
  const db = dataClientFor(accessToken);
  const admin = await db.rpc("current_user_is_admin");
  if (admin.error) {
    console.error("[admin] organizer check failed", { code: admin.error.code });
    return { ok: false };
  }
  if (!admin.data) return { ok: true, organizer: false };

  const [settings, slots, teams] = await Promise.all([
    db.rpc("admin_selection_settings"),
    db.rpc("admin_statement_slots"),
    db.rpc("admin_selection_teams"),
  ]);
  const row = settings.data?.[0];
  if (settings.error || slots.error || teams.error || !row || !isState(row.selection_state)) {
    console.error("[admin] selection read failed", {
      settings: settings.error?.code,
      slots: slots.error?.code,
      teams: teams.error?.code,
    });
    return { ok: false };
  }
  return {
    ok: true,
    organizer: true,
    state: row.selection_state,
    resultsPublished: row.results_published,
    slots: slots.data.map((s) => ({
      statementId: s.statement_id,
      slots: s.slots,
      assigned: s.assigned,
    })),
    // The generated types mark these columns non-null, but the left join can return nulls.
    teams: (teams.data as SelectionTeamRow[]).map(toSelectionTeam),
  };
}

export type AdminRpcError =
  | "not_admin"
  | "results_published"
  | "selection_not_closed"
  | "team_not_found"
  | "already_assigned"
  | "statement_full"
  | "invalid_input"
  | "unavailable";

const known = new Set<string>([
  "not_admin",
  "results_published",
  "selection_not_closed",
  "team_not_found",
  "already_assigned",
  "statement_full",
  "invalid_input",
]);
const isKnown = (code: string): code is AdminRpcError => known.has(code);

function outcome(error: { code: string; message: string } | null): AdminRpcError | null {
  if (!error) return null;
  if (error.code === "P0001" && isKnown(error.message)) return error.message;
  console.error("[admin] selection change failed", { code: error.code });
  return "unavailable";
}

export async function setSelectionState(
  accessToken: string,
  state: SelectionState,
): Promise<AdminRpcError | null> {
  const { error } = await dataClientFor(accessToken).rpc("set_selection_state", {
    p_state: state,
  });
  return outcome(error);
}

export async function setResultsPublished(
  accessToken: string,
  published: boolean,
): Promise<AdminRpcError | null> {
  const { error } = await dataClientFor(accessToken).rpc("set_results_published", {
    p_published: published,
  });
  return outcome(error);
}

export async function assignStatementByHand(
  accessToken: string,
  reference: string,
  statementId: number,
): Promise<AdminRpcError | null> {
  const { error } = await dataClientFor(accessToken).rpc("assign_statement_by_hand", {
    p_reference: reference,
    p_statement: statementId,
  });
  return outcome(error);
}
