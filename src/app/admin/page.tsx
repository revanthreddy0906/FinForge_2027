import Link from "next/link";
import { Suspense } from "react";
import { TeamsTable } from "@/components/admin/teams-table";
import { Button, buttonClasses } from "@/components/ui/button";
import { formatRegisteredAt, formatRupees } from "@/lib/admin/registrations";
import { loadConsoleData } from "@/lib/server/admin-data";
import { requireConsole } from "@/lib/server/require-console";
import { signOutAction } from "./login/actions";

function SignOut() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary">
        Sign out
      </Button>
    </form>
  );
}

async function Console() {
  const { email, accessToken } = await requireConsole("/admin");
  const data = await loadConsoleData(accessToken);

  if (!data.ok) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-md border border-border-danger p-lg"
      >
        <h2 className="font-display text-heading-3 text-text-primary">
          Registrations couldn&apos;t load
        </h2>
        <p className="text-body text-text-secondary">
          The database didn&apos;t answer. Reload the page in a minute.
        </p>
        <SignOut />
      </div>
    );
  }

  if (!data.organizer) {
    return (
      <div className="flex flex-col items-start gap-md border border-border-frame p-lg">
        <h2 className="font-display text-heading-3 text-text-primary">No organizer access</h2>
        <p className="text-body text-text-secondary">
          {email} isn&apos;t on the organizer list. Ask the FinForge team to add it.
        </p>
        <SignOut />
      </div>
    );
  }

  const memberCount = data.teams.reduce((sum, t) => sum + t.members.length, 0);
  const paidTeams = data.teams.filter((t) => t.payment.state === "paid");
  const collected = paidTeams.reduce((sum, t) => sum + (t.payment.amountPaise ?? 0), 0);
  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <dl className="flex gap-xl">
          <div>
            <dt className="text-eyebrow text-text-secondary uppercase">Teams</dt>
            <dd className="font-display text-heading-1 text-text-primary" data-testid="team-count">
              {data.teams.length}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow text-text-secondary uppercase">Participants</dt>
            <dd className="font-display text-heading-1 text-text-primary">{memberCount}</dd>
          </div>
          <div>
            <dt className="text-eyebrow text-text-secondary uppercase">Paid teams</dt>
            <dd className="font-display text-heading-1 text-text-primary" data-testid="paid-count">
              {paidTeams.length}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow text-text-secondary uppercase">Collected</dt>
            <dd className="font-display text-heading-1 text-text-primary">
              {formatRupees(collected)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-sm">
          {/* A plain link: the browser downloads the file, no client JavaScript involved. */}
          <a href="/admin/export" className={buttonClasses("primary")} download>
            Download CSV
          </a>
          <Link href="/admin/statements" className={buttonClasses("secondary")}>
            Problem statements
          </Link>
          <SignOut />
        </div>
      </div>
      <p className="text-body-sm text-text-secondary">Signed in as {email}</p>
      {data.refunds.length > 0 && (
        <section
          aria-labelledby="refunds-title"
          className="flex flex-col gap-sm border border-border-danger p-lg"
        >
          <h2 id="refunds-title" className="font-display text-heading-3 text-text-primary">
            Payments to refund ({data.refunds.length})
          </h2>
          <p className="text-body-sm text-text-secondary">
            These teams paid after their hold ran out, and the team was removed. Refund each one in
            full from the Razorpay dashboard (Transactions, Payments, search the payment ID).
          </p>
          <ul className="flex flex-col gap-xs text-body-sm text-text-primary">
            {data.refunds.map((r) => (
              <li key={r.razorpay_payment_id ?? r.team_reference} className="tabular-nums">
                {r.team_reference} · {r.team_name} · {formatRupees(r.amount_paise)} ·{" "}
                {r.razorpay_payment_id} · {r.paid_at ? formatRegisteredAt(r.paid_at) : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      <TeamsTable teams={data.teams} now={data.loadedAt} />
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-[80rem] flex-col gap-xl">
      <h1 className="font-display text-heading-1 text-text-primary">Registered teams</h1>
      <Suspense fallback={<p className="text-body text-text-secondary">Loading registrations…</p>}>
        <Console />
      </Suspense>
    </div>
  );
}
