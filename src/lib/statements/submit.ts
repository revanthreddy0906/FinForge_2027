import {
  selectionErrorsFrom,
  selectionSchema,
  type SelectionErrors,
  type SelectionInput,
} from "./schema";

/** What the selection form shows after a submit. */
export type SubmitResult =
  | { status: "idle" }
  | { status: "submitted"; reference: string; submittedAt: string }
  | { status: "already-submitted"; reference: string; submittedAt: string | null }
  | { status: "error"; message: string; fieldErrors: SelectionErrors };

export const initialSubmitResult: SubmitResult = { status: "idle" };

/** Codes raised by public.submit_statement_choice (see supabase/migrations). */
export type SubmitDbError =
  "invalid_ranking" | "selection_not_open" | "selection_closed" | "team_not_found" | "not_eligible";

export type SaveChoiceOutcome =
  | { ok: true; outcome: "submitted" | "already_submitted"; submittedAt: string | null }
  | { ok: false; code: SubmitDbError | "unavailable" };

export interface SubmitDeps {
  /** true when this network may submit now (a loose limit: a whole venue can share one IP). */
  allowNetwork: () => Promise<boolean>;
  saveChoice: (input: SelectionInput) => Promise<SaveChoiceOutcome>;
}

export const submitCopy = {
  invalid: "Some details need fixing. Check the highlighted fields.",
  networkLimited:
    "Too many attempts from this network right now. Wait a minute, then submit again. Your order is still here.",
  notOpen: "Problem statement selection hasn't opened yet. Wait for the organizers' announcement.",
  closed:
    "Problem statement selection has closed. If your team didn't submit, speak to the organizers' desk.",
  teamNotFound:
    "We can't find a registered team with that reference. Check the reference from your registration and try again.",
  notEligible:
    "This team can't choose a problem statement because its registration isn't paid or was withdrawn. Speak to the organizers' desk.",
  unavailable:
    "We couldn't save your choices just now. Nothing was submitted, so please try again in a minute.",
} as const;

const error = (message: string, fieldErrors: SelectionErrors = {}): SubmitResult => ({
  status: "error",
  message,
  fieldErrors,
});

/** Validates, applies the limits, then saves once. Never throws. */
export async function submitSelection(raw: unknown, deps: SubmitDeps): Promise<SubmitResult> {
  try {
    const parsed = selectionSchema.safeParse(raw);
    if (!parsed.success) return error(submitCopy.invalid, selectionErrorsFrom(parsed.error));
    const data = parsed.data;

    if (!(await deps.allowNetwork())) return error(submitCopy.networkLimited);

    const saved = await deps.saveChoice(data);
    if (saved.ok) {
      return saved.outcome === "submitted" && saved.submittedAt
        ? { status: "submitted", reference: data.reference, submittedAt: saved.submittedAt }
        : {
            status: "already-submitted",
            reference: data.reference,
            submittedAt: saved.submittedAt,
          };
    }
    switch (saved.code) {
      case "team_not_found":
        return error(submitCopy.teamNotFound, { reference: submitCopy.teamNotFound });
      case "invalid_ranking":
        return error(submitCopy.invalid, { ranking: "Put all four problem statements in order." });
      case "selection_not_open":
        return error(submitCopy.notOpen);
      case "selection_closed":
        return error(submitCopy.closed);
      case "not_eligible":
        return error(submitCopy.notEligible);
      case "unavailable":
        return error(submitCopy.unavailable);
    }
  } catch {
    return error(submitCopy.unavailable);
  }
}

/** "10:02:13 am" in India time, for the confirmation. */
export function formatSubmittedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
