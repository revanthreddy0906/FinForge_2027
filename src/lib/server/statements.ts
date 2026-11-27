import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { SelectionInput } from "@/lib/statements/schema";
import type { SaveChoiceOutcome, SubmitDbError } from "@/lib/statements/submit";
import { supabaseAdmin } from "./supabase-admin";

export type SelectionState = "not_open" | "open" | "closed";

export interface SelectionStatus {
  state: SelectionState;
  resultsPublished: boolean;
}

export interface PublishedResult {
  reference: string;
  statementId: number;
}

/**
 * Cache tags for the public pages. Organizer actions expire them (updateTag), so a change shows
 * at once; the short lifetimes below are only a safety net if an expiry is missed.
 */
export const STATUS_TAG = "statements-status";
export const RESULTS_TAG = "statements-results";

const states = new Set<string>(["not_open", "open", "closed"]);
function isState(value: string): value is SelectionState {
  return states.has(value);
}

/**
 * Window state for the public pages, from a cache shared by all server instances, so a crowd
 * loading the page does not reach the database. Throws when the database can't be read
 * (nothing is cached then), and the page shows its fallback.
 */
export async function selectionStatus(): Promise<SelectionStatus> {
  "use cache: remote";
  cacheTag(STATUS_TAG);
  cacheLife({ stale: 15, revalidate: 15, expire: 120 });
  const { data, error } = await supabaseAdmin().rpc("selection_status");
  const row = data?.[0];
  if (error || !row || !isState(row.selection_state)) {
    console.error("[statements] status read failed", { code: error?.code });
    throw new Error("selection status unavailable");
  }
  return { state: row.selection_state, resultsPublished: row.results_published };
}

/** Published assignments (empty until organizers publish), cached like the status. */
export async function publishedResults(): Promise<PublishedResult[]> {
  "use cache: remote";
  cacheTag(RESULTS_TAG);
  cacheLife({ stale: 15, revalidate: 15, expire: 120 });
  const { data, error } = await supabaseAdmin().rpc("published_results");
  if (error) {
    console.error("[statements] results read failed", { code: error.code });
    throw new Error("results unavailable");
  }
  return data.map((r) => ({ reference: r.team_reference, statementId: r.statement_id }));
}

const knownCodes = new Set<string>([
  "invalid_ranking",
  "selection_not_open",
  "selection_closed",
  "team_not_found",
  "not_eligible",
]);
function isDbError(code: string): code is SubmitDbError {
  return knownCodes.has(code);
}

/** Calls public.submit_statement_choice. Unknown failures become "unavailable". */
export async function saveChoice(input: SelectionInput): Promise<SaveChoiceOutcome> {
  const { data, error } = await supabaseAdmin().rpc("submit_statement_choice", {
    p_reference: input.reference,
    p_ranking: input.ranking,
  });
  if (error) {
    if (error.code === "P0001" && isDbError(error.message))
      return { ok: false, code: error.message };
    console.error("[statements] submit failed", { code: error.code });
    return { ok: false, code: "unavailable" };
  }
  const row = data[0];
  if (!row || (row.outcome !== "submitted" && row.outcome !== "already_submitted")) {
    return { ok: false, code: "unavailable" };
  }
  // submitted_at is null for a team an organizer assigned by hand.
  const submittedAt = row.submitted_at as string | null;
  return { ok: true, outcome: row.outcome, submittedAt };
}
