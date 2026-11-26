import { event, type RegistrationState } from "@/config/event";
import type { PaymentStart, StartOutcome } from "@/lib/payments/flow";
import {
  fieldErrorsFrom,
  memberLabel,
  registrationSchema,
  toRegisterTeamPayload,
  type FieldErrors,
} from "./schema";

/** What the form shows after a submit. */
export type RegisterResult =
  | { status: "idle" }
  | { status: "success"; reference: string; teamName: string }
  | { status: "payment"; payment: PaymentStart }
  | { status: "error"; message: string; fieldErrors: FieldErrors };

export const initialRegisterResult: RegisterResult = { status: "idle" };

/** Codes raised by public.register_team (see supabase/migrations). */
export type DbErrorCode =
  | "invalid_input"
  | "invalid_team_size"
  | "duplicate_member_email"
  | "team_name_taken"
  | "email_taken"
  | "team_name_held"
  | "email_held"
  | "event_full";

export type SaveOutcome =
  | { ok: true; teamId: string; reference: string; created: boolean }
  | { ok: false; code: DbErrorCode; detail?: string }
  | { ok: false; code: "unavailable" };

/** Everything the flow talks to, injected so it can be tested without network calls. */
export interface RegisterDeps {
  registrationState: () => RegistrationState;
  /** true when this IP may submit now. */
  allowRequest: (ip: string) => Promise<boolean>;
  verifyHuman: (token: string, ip: string) => Promise<boolean>;
  saveTeam: (payload: ReturnType<typeof toRegisterTeamPayload>) => Promise<SaveOutcome>;
  /** Creates or reuses the team's Razorpay order. Must not throw. */
  startPayment: (teamId: string) => Promise<StartOutcome>;
}

export const copy = {
  notOpen: {
    "coming-soon": "Registration hasn't opened yet. Check the timeline for when it starts.",
    closed: "Registration has closed. Thanks for your interest in FinForge 2027.",
  },
  rateLimited: "Too many attempts from your network. Please wait a minute, then try again.",
  invalid: "Some details need fixing. Check the highlighted fields.",
  humanCheck: "We couldn't confirm you're human. Complete the check below and submit again.",
  unavailable:
    "We couldn't save your registration just now. Your details are still here, so please try again in a minute.",
  eventFull: `${event.name} is full, so we can't take more teams. Thanks for your interest.`,
  teamNameTaken: "Another team already has this name. Please choose a different one.",
  emailTaken: "This email is already registered in another team. Each person can join one team.",
  teamNameHeld: `A team with this name is waiting to pay. If that's your team, finish paying in the tab where you started. Otherwise pick another name, or try again after ${String(event.paymentHoldMinutes)} minutes.`,
  emailHeld: `This email is in a team that is waiting to pay. Finish paying in the tab where you started, or try again after ${String(event.paymentHoldMinutes)} minutes.`,
  paymentUnavailable:
    "Your team is saved, but we couldn't start the payment just now. Press Register team again in a minute to continue.",
} as const;

const error = (message: string, fieldErrors: FieldErrors = new Map()): RegisterResult => ({
  status: "error",
  message,
  fieldErrors,
});

/** Validates, checks limits and the human check, then saves. Never throws. */
export async function registerTeam(
  raw: unknown,
  turnstileToken: string,
  ip: string,
  deps: RegisterDeps,
): Promise<RegisterResult> {
  try {
    const state = deps.registrationState();
    if (state === "coming-soon") return error(copy.notOpen["coming-soon"]);
    if (state === "closed") return error(copy.notOpen.closed);

    if (!(await deps.allowRequest(ip))) return error(copy.rateLimited);

    const parsed = registrationSchema.safeParse(raw);
    if (!parsed.success) return error(copy.invalid, fieldErrorsFrom(parsed.error));
    const data = parsed.data;

    if (!turnstileToken || !(await deps.verifyHuman(turnstileToken, ip))) {
      return error(copy.humanCheck);
    }

    const saved = await deps.saveTeam(toRegisterTeamPayload(data));
    if (!saved.ok) return mapSaveError(saved, data.members);

    // New teams and retries both land here: the same team keeps the same order.
    const started = await deps.startPayment(saved.teamId);
    switch (started.kind) {
      case "pay":
        return { status: "payment", payment: started.payment };
      case "paid":
        return { status: "success", reference: started.reference, teamName: started.teamName };
      case "unavailable":
        return error(copy.paymentUnavailable);
    }
  } catch {
    return error(copy.unavailable);
  }
}

function mapSaveError(
  saved: Exclude<SaveOutcome, { ok: true }>,
  members: readonly { email: string }[],
): RegisterResult {
  switch (saved.code) {
    case "team_name_taken":
      return error(copy.teamNameTaken, new Map([["teamName", copy.teamNameTaken]]));
    case "email_taken": {
      const i = saved.detail ? members.findIndex((m) => m.email === saved.detail) : -1;
      if (i < 0) return error(copy.emailTaken);
      const message = `This email is already registered in another team. Each person can join one team, so use a different email for ${memberLabel(i)}.`;
      return error(copy.emailTaken, new Map([[`members.${String(i)}.email`, message]]));
    }
    case "team_name_held":
      return error(copy.teamNameHeld, new Map([["teamName", copy.teamNameHeld]]));
    case "email_held": {
      const i = saved.detail ? members.findIndex((m) => m.email === saved.detail) : -1;
      if (i < 0) return error(copy.emailHeld);
      return error(copy.emailHeld, new Map([[`members.${String(i)}.email`, copy.emailHeld]]));
    }
    case "event_full":
      return error(copy.eventFull);
    case "invalid_input":
    case "invalid_team_size":
    case "duplicate_member_email":
      return error(copy.invalid);
    case "unavailable":
      return error(copy.unavailable);
  }
}
