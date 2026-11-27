import "server-only";

/**
 * The four event-day problem statements. Server-only, so the texts never reach the browser
 * bundle: the selection page renders them on the server, and only once organizers open the
 * window. Slots mirror private.problem_statements in the database, which is what is enforced.
 */
export interface ProblemStatement {
  readonly id: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly summary: string;
  /** Teams this statement takes. Mirrors the database. */
  readonly slots: number;
}

// TODO: problem statement texts (titles and summaries, to be announced).
// TODO: slots per statement. Provisional 19 each; organizers confirm the limits later and
// change them here and in private.problem_statements together.
export const problemStatements: readonly ProblemStatement[] = [
  {
    id: 1,
    title: "TODO: problem statement 1",
    summary: "TODO: one-paragraph summary.",
    slots: 19,
  },
  {
    id: 2,
    title: "TODO: problem statement 2",
    summary: "TODO: one-paragraph summary.",
    slots: 19,
  },
  {
    id: 3,
    title: "TODO: problem statement 3",
    summary: "TODO: one-paragraph summary.",
    slots: 19,
  },
  {
    id: 4,
    title: "TODO: problem statement 4",
    summary: "TODO: one-paragraph summary.",
    slots: 19,
  },
];

export function statementTitle(id: number): string {
  return problemStatements.find((s) => s.id === id)?.title ?? `Problem statement ${String(id)}`;
}
