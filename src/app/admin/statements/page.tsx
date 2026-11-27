import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { problemStatements, statementTitle } from "@/config/problem-statements";
import { formatRegisteredAt } from "@/lib/admin/registrations";
import {
  assignmentLabel,
  formatTeamCode,
  rankingLabel,
  statementsWithRoom,
  teamsNeedingStatement,
} from "@/lib/admin/selection";
import { loadSelectionConsole } from "@/lib/server/admin-statements";
import { requireConsole } from "@/lib/server/require-console";
import { assignAction, setPublishedAction, setStateAction } from "./actions";

const doneMessages = new Map<string, string>([
  ["opened", "Selection is open. Teams can submit now."],
  ["closed", "Selection is closed. No more submissions are accepted."],
  ["reset", "Selection is back to “not open yet”."],
  ["published", "Results are published on the public results page."],
  ["unpublished", "Results are hidden from the public results page again."],
  ["assigned", "Statement assigned."],
]);

const errorMessages = new Map<string, string>([
  ["not_confirmed", "Tick the box to confirm, then press the button again."],
  ["results_published", "Unpublish the results first."],
  ["selection_not_closed", "Close selection first."],
  ["team_not_found", "No paid team has that reference."],
  ["already_assigned", "That team already has a statement. Assignments can't be changed."],
  ["statement_full", "That statement has no slots left. Pick another one."],
  ["invalid_input", "Something in the form wasn't valid. Try again."],
  ["not_admin", "This account isn't an organizer, or the sign-in needs the authenticator code."],
  ["unavailable", "The database didn't answer. Try again in a minute."],
]);

const stateLabel = (state: "not_open" | "open" | "closed") =>
  state === "open" ? "Open" : state === "closed" ? "Closed" : "Not open yet";

function Confirm({ id, label }: { id: string; label: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-sm text-body-sm text-text-primary">
      <input
        id={id}
        type="checkbox"
        name="confirm"
        value="yes"
        required
        className="mt-1 size-5 accent-(--color-bg-accent)"
      />
      <span>{label}</span>
    </label>
  );
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

async function Panel({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const done = one(params.done);
  const error = one(params.error);
  const { accessToken } = await requireConsole("/admin/statements");
  const data = await loadSelectionConsole(accessToken);

  if (!data.ok) {
    return (
      <div role="alert" className="border border-border-danger p-lg">
        <h2 className="font-display text-heading-3 text-text-primary">
          Selection couldn&apos;t load
        </h2>
        <p className="text-body text-text-secondary">
          The database didn&apos;t answer. Reload the page in a minute.
        </p>
      </div>
    );
  }
  if (!data.organizer) {
    return (
      <div className="border border-border-frame p-lg">
        <h2 className="font-display text-heading-3 text-text-primary">No organizer access</h2>
      </div>
    );
  }

  const { state, resultsPublished, slots, teams } = data;
  const submitted = teams.filter((t) => t.submittedAt !== null).length;
  const needing = teamsNeedingStatement(teams);
  const withRoom = statementsWithRoom(slots);
  const canAssign = state === "closed" && !resultsPublished;
  const notice = done ? doneMessages.get(done) : undefined;
  const problem = error ? errorMessages.get(error) : undefined;

  return (
    <div className="flex flex-col gap-2xl">
      {notice && (
        <p role="status" className="border border-border-frame p-md text-body text-text-primary">
          {notice}
        </p>
      )}
      {problem && (
        <p role="alert" className="border border-border-danger p-md text-body text-text-danger">
          {problem}
        </p>
      )}

      <section aria-labelledby="window-title" className="flex flex-col gap-lg">
        <div className="flex flex-wrap items-center gap-md">
          <h2 id="window-title" className="font-display text-heading-3 text-text-primary">
            Selection window
          </h2>
          <Badge tone={state === "open" ? "accent" : state === "closed" ? "danger" : "neutral"}>
            {stateLabel(state)}
          </Badge>
          <Badge tone={resultsPublished ? "success" : "neutral"}>
            {resultsPublished ? "Results published" : "Results hidden"}
          </Badge>
        </div>
        <dl className="flex flex-wrap gap-xl">
          <div>
            <dt className="text-eyebrow text-text-secondary uppercase">Paid teams</dt>
            <dd className="font-display text-heading-1 text-text-primary">{teams.length}</dd>
          </div>
          <div>
            <dt className="text-eyebrow text-text-secondary uppercase">Submitted</dt>
            <dd
              className="font-display text-heading-1 text-text-primary"
              data-testid="submitted-count"
            >
              {submitted}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow text-text-secondary uppercase">Need a statement</dt>
            <dd className="font-display text-heading-1 text-text-primary">{needing.length}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-lg md:flex-row md:flex-wrap">
          {state !== "open" && !resultsPublished && (
            <form
              action={setStateAction}
              className="flex flex-col gap-sm border border-border-default p-md"
            >
              <input type="hidden" name="state" value="open" />
              <Confirm
                id="confirm-open"
                label="Open selection now. Teams can submit straight away."
              />
              <div>
                <Button type="submit">Open selection</Button>
              </div>
            </form>
          )}
          {state === "open" && (
            <form
              action={setStateAction}
              className="flex flex-col gap-sm border border-border-default p-md"
            >
              <input type="hidden" name="state" value="closed" />
              <Confirm
                id="confirm-close"
                label="Close selection now. No more submissions will be accepted."
              />
              <div>
                <Button type="submit">Close selection</Button>
              </div>
            </form>
          )}
          {state === "closed" && !resultsPublished && (
            <form
              action={setPublishedAction}
              className="flex flex-col gap-sm border border-border-default p-md"
            >
              <input type="hidden" name="published" value="true" />
              <Confirm
                id="confirm-publish"
                label="Publish every team's statement on the public results page."
              />
              <div>
                <Button type="submit">Publish results</Button>
              </div>
            </form>
          )}
          {resultsPublished && (
            <form
              action={setPublishedAction}
              className="flex items-end border border-border-default p-md"
            >
              <input type="hidden" name="published" value="false" />
              <Button type="submit" variant="secondary">
                Unpublish results
              </Button>
            </form>
          )}
          {state === "open" && submitted === 0 && (
            <form
              action={setStateAction}
              className="flex items-end border border-border-default p-md"
            >
              <input type="hidden" name="state" value="not_open" />
              <Button type="submit" variant="secondary">
                Set back to not open
              </Button>
            </form>
          )}
        </div>
        <div className="flex flex-wrap gap-sm">
          <a href="/admin/statements/codes" className={buttonClasses("secondary")} download>
            Download team codes (CSV)
          </a>
          <a href="/admin/statements/export" className={buttonClasses("secondary")} download>
            Download choices (CSV)
          </a>
          <a href="/statements" className={buttonClasses("ghost")} target="_blank" rel="noopener">
            Open the team page
          </a>
          <a
            href="/statements/results"
            className={buttonClasses("ghost")}
            target="_blank"
            rel="noopener"
          >
            Open the results page
          </a>
        </div>
      </section>

      <section aria-labelledby="slots-title" className="flex flex-col gap-md">
        <h2 id="slots-title" className="font-display text-heading-3 text-text-primary">
          Slots
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-body-sm" data-testid="slots">
            <thead className="text-eyebrow text-text-secondary uppercase">
              <tr>
                <th scope="col" className="py-xs pr-md">
                  Statement
                </th>
                <th scope="col" className="py-xs pr-md">
                  Slots
                </th>
                <th scope="col" className="py-xs pr-md">
                  Assigned
                </th>
                <th scope="col" className="py-xs">
                  Left
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-primary tabular-nums">
              {slots.map((s) => (
                <tr key={s.statementId}>
                  <th scope="row" className="py-sm pr-md font-normal">
                    {s.statementId}. {statementTitle(s.statementId)}
                  </th>
                  <td className="py-sm pr-md">{s.slots}</td>
                  <td className="py-sm pr-md">{s.assigned}</td>
                  <td className="py-sm">{s.slots - s.assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {needing.length > 0 && (
        <section aria-labelledby="needing-title" className="flex flex-col gap-md">
          <h2 id="needing-title" className="font-display text-heading-3 text-text-primary">
            Teams that need a statement ({needing.length})
          </h2>
          <p className="text-body-sm text-text-secondary">
            {canAssign
              ? "Assign each one a statement that still has room. An assignment can't be changed afterwards."
              : state === "closed"
                ? "Unpublish the results to assign these teams."
                : "You can assign these teams by hand once selection is closed."}
          </p>
          <ul className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
            {needing.map((t) => (
              <li
                key={t.reference}
                className="flex flex-col gap-sm py-md md:flex-row md:items-center md:justify-between"
              >
                <span className="text-body text-text-primary">
                  <span className="text-label text-text-accent tabular-nums">{t.reference}</span>{" "}
                  {t.teamName} · {assignmentLabel(t)}
                  {t.ranking && ` · ranked ${rankingLabel(t.ranking)}`}
                </span>
                {canAssign && withRoom.length > 0 && (
                  <form action={assignAction} className="flex flex-wrap items-center gap-sm">
                    <input type="hidden" name="reference" value={t.reference} />
                    <label htmlFor={`assign-${t.reference}`} className="sr-only">
                      Statement for {t.reference}
                    </label>
                    <select
                      id={`assign-${t.reference}`}
                      name="statement"
                      required
                      className="min-h-12 rounded-xs border border-border-default bg-bg-surface px-md text-body text-text-primary"
                    >
                      {withRoom.map((s) => (
                        <option key={s.statementId} value={s.statementId}>
                          {s.statementId}. {statementTitle(s.statementId)} ({s.slots - s.assigned}{" "}
                          left)
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary">
                      Assign
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {canAssign && withRoom.length === 0 && (
            <p className="text-body-sm text-text-danger">
              Every statement is full. Raise a statement&apos;s slots in the database first.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="teams-title" className="flex flex-col gap-md">
        <h2 id="teams-title" className="font-display text-heading-3 text-text-primary">
          All paid teams
        </h2>
        <p className="text-body-sm text-text-secondary">
          Rankings use statement numbers, 1st choice first:{" "}
          {problemStatements.map((s) => `${String(s.id)}. ${s.title}`).join(" · ")}
        </p>
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[56rem] text-left text-body-sm"
            data-testid="selection-teams"
          >
            <thead className="text-eyebrow text-text-secondary uppercase">
              <tr>
                <th scope="col" className="py-xs pr-md">
                  Reference
                </th>
                <th scope="col" className="py-xs pr-md">
                  Team
                </th>
                <th scope="col" className="py-xs pr-md">
                  Team code
                </th>
                <th scope="col" className="py-xs pr-md">
                  Submitted (IST)
                </th>
                <th scope="col" className="py-xs pr-md">
                  Ranking
                </th>
                <th scope="col" className="py-xs">
                  Statement
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-primary">
              {teams.map((t) => (
                <tr key={t.reference}>
                  <th scope="row" className="py-sm pr-md font-normal tabular-nums">
                    {t.reference}
                  </th>
                  <td className="py-sm pr-md">{t.teamName}</td>
                  <td className="font-mono py-sm pr-md">{formatTeamCode(t.code)}</td>
                  <td className="py-sm pr-md tabular-nums">
                    {t.submittedAt ? formatRegisteredAt(t.submittedAt) : "—"}
                  </td>
                  <td className="py-sm pr-md tabular-nums">{rankingLabel(t.ranking) || "—"}</td>
                  <td className="py-sm">
                    {t.assignedStatement === null ? "—" : `${String(t.assignedStatement)}. `}
                    <span className="text-text-secondary">{assignmentLabel(t)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function StatementsConsolePage({ searchParams }: PageProps<"/admin/statements">) {
  return (
    <div className="mx-auto flex max-w-[80rem] flex-col gap-xl">
      <p>
        <Link href="/admin" className="text-label text-text-accent underline underline-offset-4">
          ← Registered teams
        </Link>
      </p>
      <h1 className="font-display text-heading-1 text-text-primary">Problem statements</h1>
      <Suspense fallback={<p className="text-body text-text-secondary">Loading selection…</p>}>
        <Panel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
