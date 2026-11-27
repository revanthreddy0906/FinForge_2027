import { z } from "zod";

// See src/lib/registration/schema.ts: the CSP forbids eval, so Zod's JIT stays off.
z.config({ jitless: true });

/**
 * Statement selection form rules, shared by the form (client) and the server action.
 * public.submit_statement_choice checks them again and is the final word.
 */

export const STATEMENT_COUNT = 4;

export const copy = {
  referenceRequired: "Enter your team reference, for example FF27-0080.",
  referenceFormat: "Team references look like FF27-0080. Check the reference and try again.",
  rankingInvalid: "Put all four problem statements in order, from 1st to 4th choice.",
} as const;

/** "ff27 - 80" or "FF27-0080" → "FF27-0080". Anything else is returned trimmed and upper case. */
export function normaliseReference(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const match = /^FF27-?(\d{1,4})$/.exec(compact);
  return match?.[1] ? `FF27-${match[1].padStart(4, "0")}` : compact;
}

const isPermutation = (ranking: readonly number[]) =>
  ranking.length === STATEMENT_COUNT &&
  [...ranking].sort((a, b) => a - b).every((value, i) => value === i + 1);

export const selectionSchema = z.object({
  reference: z
    .string({ error: copy.referenceRequired })
    .max(40, { error: copy.referenceFormat })
    .transform(normaliseReference)
    .pipe(
      z
        .string()
        .min(1, { error: copy.referenceRequired })
        .regex(/^FF27-\d{4}$/, { error: copy.referenceFormat }),
    ),
  ranking: z
    .array(
      z
        .int({ error: copy.rankingInvalid })
        .min(1, { error: copy.rankingInvalid })
        .max(STATEMENT_COUNT, { error: copy.rankingInvalid }),
      { error: copy.rankingInvalid },
    )
    .refine(isPermutation, { error: copy.rankingInvalid }),
});

export type SelectionInput = z.infer<typeof selectionSchema>;
export type SelectionField = "reference" | "ranking";
export type SelectionErrors = Partial<Record<SelectionField, string>>;

export function selectionErrorsFrom(error: z.ZodError): SelectionErrors {
  const first = (field: SelectionField) =>
    error.issues.find((issue) => issue.path[0] === field)?.message;
  return { reference: first("reference"), ranking: first("ranking") };
}

/** Form field names, shared by the form and the server action. */
export const selectionField = {
  reference: "reference",
  ranking: "ranking",
} as const;

/** Reads the form: the ranking is sent as "3,1,4,2" (statement ids, 1st choice first). */
export function selectionFormData(fd: FormData): unknown {
  const text = (key: string) => {
    const value = fd.get(key);
    return typeof value === "string" ? value : undefined;
  };
  const ranking = text(selectionField.ranking);
  return {
    reference: text(selectionField.reference),
    ranking: ranking === undefined ? undefined : ranking.split(",").map((v) => Number(v.trim())),
  };
}
