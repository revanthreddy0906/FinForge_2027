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
  headline: "Where the future of finance gets built",
  /** How the event describes itself: a two-day festival around a 24-hour hackathon. */
  format: "Hyderabad's first AI x FinTech innovation festival",
  durationDays: 2,
  hackathonHours: 24,
  /**
   * Teams that compete, from the event document. Display only: the registration cap is
   * private.event_settings.max_teams in the database. TODO: confirm whether to set that cap to 75.
   */
  teamCount: 75,
  /** Engineering colleges the participants come from. */
  collegeCount: 25,

  /** ISO dates (YYYY-MM-DD) from the official event document. */
  startDate: "2027-03-20" as string | null,
  endDate: "2027-03-21" as string | null,
  dateLabel: "20–21 March 2027",
  shortDateLabel: "20–21 Mar 2027",

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
  prizeExtras: "API credits and curated prizes from our partners",
  // TODO: prize breakdown by position and track.
  prizeBreakdown: null as null | readonly { label: string; amount: number }[],

  // TODO: registration open/close dates. Flip this to "open" when registration starts.
  registration: registrationState("coming-soon"),
  registrationPath: "/register",

  /** Judging criteria, in the order the event document lists them. */
  judgingCriteria: ["Financial impact", "Technical rigor", "Responsible AI", "Deployability"],

  // TODO: tracks and problem statements (to be released; revealed minutes before the timer starts).
  tracks: null as null | readonly { title: string; description: string }[],

  // TODO: sponsors.
  sponsors: [] as readonly { name: string; url: string }[],

  /** Organizer contacts from the event document, in the order they should appear. */
  contacts: [
    {
      name: "Pranathi Vemuri",
      role: "Organiser",
      phone: "+919866649095",
      phoneLabel: "+91 98666 49095",
    },
    {
      name: "Revanth Reddy",
      role: "Organiser",
      phone: "+919866403464",
      phoneLabel: "+91 98664 03464",
    },
  ],

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
      description:
        "Two days at Jubilee Hills Convention Centre, Hyderabad, with a 24-hour build at the centre.",
      date: "2027-03-20",
      dateLabel: "20–21 March 2027",
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
