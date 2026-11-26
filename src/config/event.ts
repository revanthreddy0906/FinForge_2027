/**
 * Every FinForge 2027 event fact lives here. Change a date or the registration
 * state with a one-line edit; components never hard-code these values.
 * Never put guessed values here: unknown facts stay `null` and the UI shows "TBA".
 */

export type RegistrationState = "coming-soon" | "open" | "closed";

const registrationStates: readonly RegistrationState[] = ["coming-soon", "open", "closed"];

/**
 * The registration state is set below. NEXT_PUBLIC_REGISTRATION_STATE can override it for a
 * staging preview or the end-to-end tests (for example "open"); leave it unset in production.
 */
function registrationState(fallback: RegistrationState): RegistrationState {
  const override = process.env.NEXT_PUBLIC_REGISTRATION_STATE;
  return registrationStates.find((s) => s === override) ?? fallback;
}

export interface TimelineEntry {
  readonly title: string;
  readonly description: string;
  /** ISO date (YYYY-MM-DD) once fixed, otherwise null. */
  readonly date: string | null;
  /** Shown when `date` is null. */
  readonly dateLabel: string;
}

export const event = {
  name: "FinForge 2027",
  organiser: "CBIT FinFoundry",
  organiserDescription: "the financial club of CBIT",
  tagline: "Plan · Build · Earn · Inspire",
  theme: "Fraud detection and cybersecurity",

  // TODO: exact dates. Keep null until fixed; JSON-LD must not get guessed dates.
  startDate: null as string | null,
  endDate: null as string | null,
  dateLabel: "2nd week of March 2027",
  shortDateLabel: "March 2027",

  venue: {
    name: "Jubilee Hills Convention Centre",
    city: "Hyderabad",
  },

  team: { minSize: 2, maxSize: 5 },

  /**
   * Registration fee, charged per team member when the team registers (Razorpay). The server
   * multiplies this by the member count saved in the database, never by anything the browser sends.
   */
  fee: { perMemberRupees: 699 },
  /** Minutes an unpaid registration keeps its team name and emails. Mirrors the database setting. */
  paymentHoldMinutes: 30,

  /** Rupees. */
  prizePool: 300_000,
  // TODO: prize breakdown by position and track.
  prizeBreakdown: null as null | readonly { label: string; amount: number }[],

  // TODO: registration open/close dates. Flip this to "open" when registration starts.
  registration: registrationState("coming-soon"),
  registrationPath: "/register",

  // TODO: tracks. Placeholders render until real tracks are announced.
  tracks: null as null | readonly { title: string; description: string }[],

  // TODO: sponsors.
  sponsors: [] as readonly { name: string; url: string }[],

  instagram: { handle: "cbit_finfoundry", url: "https://www.instagram.com/cbit_finfoundry/" },

  timeline: [
    {
      title: "Registrations open",
      description: "Team leaders register teams of 2 to 5 members.",
      date: null,
      dateLabel: "Date TBA",
    },
    {
      title: "Registrations close",
      description: "Last day to register and finalise your team.",
      date: null,
      dateLabel: "Date TBA",
    },
    {
      title: "The hackathon",
      description: "Build at Jubilee Hills Convention Centre, Hyderabad.",
      date: null,
      dateLabel: "2nd week of March 2027",
    },
    {
      title: "Results",
      description: "Winners announced and prizes awarded.",
      date: null,
      dateLabel: "Date TBA",
    },
  ] satisfies readonly TimelineEntry[],
} as const;

export const venueLabel = `${event.venue.name}, ${event.venue.city}`;
export const teamSizeLabel = `${String(event.team.minSize)} to ${String(event.team.maxSize)} members`;
