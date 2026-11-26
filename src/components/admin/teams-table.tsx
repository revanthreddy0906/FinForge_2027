"use client";

import { useDeferredValue, useState } from "react";
import { formatRegisteredAt, matchesSearch, type TeamSummary } from "@/lib/admin/registrations";

export function TeamsTable({ teams }: { teams: TeamSummary[] }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const shown = teams.filter((team) => matchesSearch(team, deferred));

  if (teams.length === 0) {
    return (
      <p className="border border-border-subtle p-lg text-body text-text-secondary">
        No teams have registered yet. New registrations show up here as soon as they&apos;re saved.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex max-w-[28rem] flex-col gap-xs">
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
        <table className="w-full min-w-[56rem] border-collapse text-left text-body-sm">
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
