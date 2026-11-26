import { z } from "zod";
import { event } from "@/config/event";

/**
 * Registration rules, shared by the form (client) and the server action.
 * They mirror the database constraints in supabase/migrations, which remain the final word.
 */

/** Bump when the privacy note on the form changes; stored with each team. */
export const CONSENT_VERSION = "2026-11-v1";

export const limits = {
  teamName: { min: 2, max: 60 },
  institution: { min: 2, max: 120 },
  fullName: { min: 2, max: 80 },
  email: { max: 254 },
  members: { min: event.team.minSize, max: event.team.maxSize },
} as const;

const text = (label: string, { min, max }: { min: number; max: number }) =>
  z
    .string({ error: `Enter ${label}.` })
    .trim()
    .min(1, { error: `Enter ${label}.` })
    .min(min, { error: `${capitalise(label)} must be at least ${String(min)} characters.` })
    .max(max, { error: `${capitalise(label)} must be ${String(max)} characters or fewer.` });

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const email = z
  .string({ error: "Enter an email address." })
  .trim()
  .toLowerCase()
  .min(1, { error: "Enter an email address." })
  .max(limits.email.max, { error: "This email address is too long." })
  .pipe(z.email({ error: "Enter an email address like name@example.com." }));

/**
 * Indian mobile number. Accepts "98765 43210", "+91 98765-43210", "098765 43210", and stores
 * the canonical "+919876543210".
 */
export const indianMobile = z
  .string({ error: "Enter the team leader's mobile number." })
  .trim()
  .min(1, { error: "Enter the team leader's mobile number." })
  .transform((raw) => raw.replace(/[\s()-]/g, ""))
  .transform((digits) => digits.replace(/^(\+91|91(?=\d{10}$)|0(?=\d{10}$))/, ""))
  .refine((n) => /^[6-9]\d{9}$/.test(n), {
    error: "Enter a 10-digit Indian mobile number, like 98765 43210.",
  })
  .transform((n) => `+91${n}`);

export const memberSchema = z.object({
  fullName: text("a full name", limits.fullName),
  email,
});

export const registrationSchema = z
  .object({
    teamName: text("a team name", limits.teamName),
    institution: text("your college name", limits.institution),
    leaderPhone: indianMobile,
    members: z
      .array(memberSchema)
      .min(limits.members.min, {
        error: `A team needs at least ${String(limits.members.min)} members.`,
      })
      .max(limits.members.max, {
        error: `A team can have at most ${String(limits.members.max)} members.`,
      }),
    consent: z.literal(true, { error: "Please confirm you've read the privacy note." }),
    idempotencyKey: z.uuid({ error: "Something went wrong with the form. Refresh and try again." }),
  })
  .superRefine((value, ctx) => {
    for (const [path, message] of duplicateEmailErrors(value.members)) {
      ctx.addIssue({ code: "custom", path: path.split("."), message });
    }
  });

/** Errors for the second and later use of an email within one team (compared lowercased). */
export function duplicateEmailErrors(members: readonly { email: string }[]): FieldErrors {
  const seen = new Map<string, number>();
  const errors = new Map<string, string>();
  members.forEach((m, i) => {
    const key = m.email.trim().toLowerCase();
    if (!key) return;
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, i);
    } else {
      errors.set(
        `members.${String(i)}.email`,
        `This email is already used for ${memberLabel(first)}. Each member needs their own email.`,
      );
    }
  });
  return errors;
}

export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

/** "the team leader" for index 0, otherwise "member 2", "member 3", ... */
export function memberLabel(index: number): string {
  return index === 0 ? "the team leader" : `member ${String(index + 1)}`;
}

/** Field errors keyed by dotted path, e.g. "members.1.email". First message per field wins. */
export type FieldErrors = ReadonlyMap<string, string>;

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out = new Map<string, string>();
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!out.has(key)) out.set(key, issue.message);
  }
  return out;
}

/** Shape sent to public.register_team (snake_case, leader first). */
export function toRegisterTeamPayload(r: Registration) {
  return {
    idempotency_key: r.idempotencyKey,
    team_name: r.teamName,
    institution: r.institution,
    leader_phone: r.leaderPhone,
    consent_version: CONSENT_VERSION,
    members: r.members.map((m) => ({ full_name: m.fullName, email: m.email })),
  };
}
