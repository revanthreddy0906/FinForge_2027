import { z } from "zod";

// See src/lib/registration/schema.ts: the CSP forbids eval, so Zod's JIT stays off.
z.config({ jitless: true });

/**
 * Statement selection form rules, shared by the form (client) and the server action.
 * public.submit_statement_choice checks them again and is the final word.
 */

export const STATEMENT_COUNT = 4;

/** Team codes use A-Z and 2-9 without I, O, 0 and 1, so they can't be misread. */
export const TEAM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export const copy = {
  referenceRequired: "Enter your team reference, for example FF27-0080.",
  referenceFormat: "Team references look like FF27-0080. Check the reference and try again.",
  codeRequired: "Enter the 8-character team code from your check-in slip.",
  codeFormat:
    "Team codes have 8 letters and numbers, for example K7MQ-2XRT. Check your check-in slip.",
  rankingInvalid: "Put all four problem statements in order, from 1st to 4th choice.",
} as const;

/** "ff27 - 80" or "FF27-0080" → "FF27-0080". Anything else is returned trimmed and upper case. */
export function normaliseReference(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const match = /^FF27-?(\d{1,4})$/.exec(compact);
  return match?.[1] ? `FF27-${match[1].padStart(4, "0")}` : compact;
}

/** "k7mq 2xrt" or "K7MQ-2XRT" → "K7MQ2XRT". */
export function normaliseCode(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
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
  code: z
    .string({ error: copy.codeRequired })
    .max(40, { error: copy.codeFormat })
    .transform(normaliseCode)
    .pipe(
      z
        .string()
        .min(1, { error: copy.codeRequired })
        .regex(TEAM_CODE_PATTERN, { error: copy.codeFormat }),
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
export type SelectionField = "reference" | "code" | "ranking";
export type SelectionErrors = Partial<Record<SelectionField, string>>;

export function selectionErrorsFrom(error: z.ZodError): SelectionErrors {
  const first = (field: SelectionField) =>
    error.issues.find((issue) => issue.path[0] === field)?.message;
  return { reference: first("reference"), code: first("code"), ranking: first("ranking") };
}

/** Form field names, shared by the form and the server action. */
export const selectionField = {
  reference: "reference",
  code: "code",
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
    code: text(selectionField.code),
    ranking: ranking === undefined ? undefined : ranking.split(",").map((v) => Number(v.trim())),
  };
}
