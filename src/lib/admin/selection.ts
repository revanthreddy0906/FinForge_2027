import { csvCell, formatRegisteredAt } from "./registrations";

/** One paid team in the organizer's selection view. */
export interface SelectionTeam {
  reference: string;
  teamName: string;
  leaderName: string;
  code: string;
  /** Statement ids, 1st choice first; null if the team never submitted. */
  ranking: number[] | null;
  submittedAt: string | null;
  assignedStatement: number | null;
  /** Which of its choices the team got (1 to 4), or null when assigned by hand or not yet. */
  assignedChoice: number | null;
  assignedBy: string | null;
}

export interface StatementSlots {
  statementId: number;
  slots: number;
  assigned: number;
}

/** The rows public.admin_selection_teams returns (left-joined fields can be null). */
export interface SelectionTeamRow {
  team_reference: string;
  team_name: string;
  leader_name: string;
  team_code: string;
  ranking: number[] | null;
  submitted_at: string | null;
  assigned_statement: number | null;
  assigned_choice: number | null;
  assigned_by: string | null;
}

export function toSelectionTeam(row: SelectionTeamRow): SelectionTeam {
  return {
    reference: row.team_reference,
    teamName: row.team_name,
    leaderName: row.leader_name,
    code: row.team_code,
    ranking: row.ranking,
    submittedAt: row.submitted_at,
    assignedStatement: row.assigned_statement,
    assignedChoice: row.assigned_choice,
    assignedBy: row.assigned_by,
  };
}

/** "K7MQ2XRT" → "K7MQ-2XRT", easier to read off a slip. The form accepts either. */
export function formatTeamCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** "3 › 1 › 4 › 2", or an empty string. */
export function rankingLabel(ranking: readonly number[] | null): string {
  return ranking ? ranking.join(" › ") : "";
}

const ordinals = ["1st", "2nd", "3rd", "4th"] as const;

/** How the team got its statement, for the console and the CSV. */
export function assignmentLabel(team: SelectionTeam): string {
  if (team.assignedStatement === null) {
    return team.ranking ? "Every choice full: assign by hand" : "Not submitted";
  }
  if (team.assignedBy) return "Assigned by hand";
  const choice = team.assignedChoice === null ? undefined : ordinals.at(team.assignedChoice - 1);
  return choice ? `${choice} choice` : "Assigned";
}

/** Teams that still need a statement from the organizers. */
export function teamsNeedingStatement(teams: readonly SelectionTeam[]): SelectionTeam[] {
  return teams.filter((t) => t.assignedStatement === null);
}

/** Statements with room left, for hand assignment. */
export function statementsWithRoom(slots: readonly StatementSlots[]): StatementSlots[] {
  return slots.filter((s) => s.assigned < s.slots);
}

function csv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  // Byte order mark so Excel opens the UTF-8 file with the right characters.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** For printing check-in slips: one row per paid team. */
export function teamCodesCsv(teams: readonly SelectionTeam[]): string {
  return csv(
    ["Reference", "Team", "Leader", "Team code"],
    teams.map((t) => [t.reference, t.teamName, t.leaderName, formatTeamCode(t.code)]),
  );
}

/** Every paid team's choices and assignment, in submission order (never-submitted last). */
export function selectionCsv(
  teams: readonly SelectionTeam[],
  titleOf: (statementId: number) => string,
): string {
  const ordered = [...teams].sort((a, b) => {
    if (a.submittedAt === b.submittedAt) return a.reference.localeCompare(b.reference);
    if (a.submittedAt === null) return 1;
    if (b.submittedAt === null) return -1;
    return a.submittedAt.localeCompare(b.submittedAt);
  });
  return csv(
    [
      "Reference",
      "Team",
      "Submitted (IST)",
      "Submitted at (UTC, exact)",
      "Ranking",
      "Assigned statement",
      "How",
      "Assigned by",
    ],
    ordered.map((t) => [
      t.reference,
      t.teamName,
      t.submittedAt ? formatRegisteredAt(t.submittedAt) : "",
      t.submittedAt ?? "",
      rankingLabel(t.ranking),
      t.assignedStatement === null ? "" : titleOf(t.assignedStatement),
      assignmentLabel(t),
      t.assignedBy ?? "",
    ]),
  );
}
