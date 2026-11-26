"use client";

import { useDeferredValue, useState } from "react";
import { event } from "@/config/event";
import {
  formatRegisteredAt,
  formatRupees,
  matchesPaymentFilter,
  matchesSearch,
  paymentLabel,
  type PaymentFilter,
  type TeamSummary,
} from "@/lib/admin/registrations";

const pillClass = new Map([
  ["Paid", "border-border-strong text-text-success"],
  ["No fee", "border-border-subtle text-text-secondary"],
  ["Waiting for payment", "border-border-frame text-text-accent"],
  ["Hold expired", "border-border-danger text-text-danger"],
]);

export function TeamsTable({ teams, now }: { teams: TeamSummary[]; now: number }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const deferred = useDeferredValue(query);
  const shown = teams.filter(
    (team) => matchesPaymentFilter(team, filter) && matchesSearch(team, deferred),
  );

  if (teams.length === 0) {
    return (
      <p className="border border-border-subtle p-lg text-body text-text-secondary">
        No teams have registered yet. New registrations show up here as soon as they&apos;re saved.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-end gap-md">
        <div className="flex w-full max-w-[28rem] flex-col gap-xs">
          <label htmlFor="team-search" className="text-label text-text-primary">
            Search teams
          </label>
          <input
            id="team-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            maxLength={100}
            placeholder="Team, college, name, email or reference"
            className="min-h-12 w-full rounded-xs border border-border-default bg-bg-surface px-md text-body text-text-primary placeholder:text-text-muted hover:border-border-strong focus-visible:border-border-focus"
          />
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor="payment-filter" className="text-label text-text-primary">
            Payment
          </label>
          <select
            id="payment-filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as PaymentFilter);
            }}
            className="min-h-12 rounded-xs border border-border-default bg-bg-surface px-md text-body text-text-primary hover:border-border-strong focus-visible:border-border-focus"
          >
            <option value="all">All teams</option>
            <option value="paid">Paid</option>
            <option value="waiting">Not paid yet</option>
          </select>
        </div>
      </div>
      <p aria-live="polite" className="text-body-sm text-text-secondary">
        Showing {shown.length} of {teams.length} teams
      </p>
      {/* Scrolls sideways on phones instead of squashing the columns. */}
      <div
        className="overflow-x-auto border border-border-subtle"
        tabIndex={0}
        role="region"
        aria-label="Registered teams table"
      >
        <table className="w-full min-w-[64rem] border-collapse text-left text-body-sm">
          <caption className="sr-only">Registered teams, oldest first</caption>
          <thead className="bg-bg-surface text-label text-text-primary">
            <tr>
              <th scope="col" className="px-md py-sm">
                Reference
              </th>
              <th scope="col" className="px-md py-sm">
                Team
              </th>
              <th scope="col" className="px-md py-sm">
                College
              </th>
              <th scope="col" className="px-md py-sm">
                Payment
              </th>
              <th scope="col" className="px-md py-sm">
                Members
              </th>
              <th scope="col" className="px-md py-sm">
                Leader mobile
              </th>
              <th scope="col" className="px-md py-sm">
                Registered (IST)
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((team) => (
              <tr key={team.reference} className="border-t border-border-subtle align-top">
                <td className="px-md py-sm whitespace-nowrap text-text-accent tabular-nums">
                  {team.reference}
                </td>
                <th scope="row" className="px-md py-sm font-medium text-text-primary">
                  {team.teamName}
                  {team.status !== "registered" && (
                    <span className="ml-xs text-text-danger">({team.status})</span>
                  )}
                </th>
                <td className="px-md py-sm text-text-secondary">{team.institution}</td>
                <td className="px-md py-sm whitespace-nowrap">
                  {(() => {
                    const label = paymentLabel(team, event.paymentHoldMinutes, now);
                    return (
                      <span
                        className={`inline-block border px-xs text-label ${pillClass.get(label) ?? "border-border-subtle text-text-secondary"}`}
                        data-testid="payment-status"
                      >
                        {label}
                      </span>
                    );
                  })()}
                  {team.payment.amountPaise !== null && (
                    <span className="block text-text-secondary tabular-nums">
                      {formatRupees(team.payment.amountPaise)}
                    </span>
                  )}
                  {team.payment.paymentId && (
                    <span className="block text-text-muted tabular-nums">
                      {team.payment.paymentId}
                    </span>
                  )}
                </td>
                <td className="px-md py-sm">
                  <ol className="flex flex-col gap-2xs">
                    {team.members.map((m) => (
                      <li key={m.position} className="text-text-primary">
                        {m.fullName}
                        {m.isLeader && <span className="text-text-accent"> · leader</span>}
                        <span className="block break-all text-text-secondary">{m.email}</span>
                      </li>
                    ))}
                  </ol>
                </td>
                <td className="px-md py-sm whitespace-nowrap text-text-secondary tabular-nums">
                  {team.leaderPhone}
                </td>
                <td className="px-md py-sm whitespace-nowrap text-text-secondary">
                  {formatRegisteredAt(team.registeredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && (
        <p className="text-body text-text-secondary">No teams match “{deferred}”.</p>
      )}
    </div>
  );
}
