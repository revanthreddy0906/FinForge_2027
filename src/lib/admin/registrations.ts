/** One row of public.admin_registrations: a team member with their team's details. */
export interface RegistrationRow {
  reference: string | null;
  team_name: string | null;
  institution: string | null;
  status: string | null;
  leader_phone: string | null;
  registered_at: string | null;
  position: number | null;
  is_leader: boolean | null;
  full_name: string | null;
  email: string | null;
}

export interface TeamMember {
  position: number;
  fullName: string;
  email: string;
  isLeader: boolean;
}

export interface TeamSummary {
  reference: string;
  teamName: string;
  institution: string;
  status: string;
  leaderPhone: string;
  registeredAt: string;
  members: TeamMember[];
}

/** Groups member rows into teams, oldest registration first, members in form order. */
export function groupTeams(rows: readonly RegistrationRow[]): TeamSummary[] {
  const teams = new Map<string, TeamSummary>();
  for (const row of rows) {
    if (!row.reference) continue;
    let team = teams.get(row.reference);
    if (!team) {
      team = {
        reference: row.reference,
        teamName: row.team_name ?? "",
        institution: row.institution ?? "",
        status: row.status ?? "",
        leaderPhone: row.leader_phone ?? "",
        registeredAt: row.registered_at ?? "",
        members: [],
      };
      teams.set(row.reference, team);
    }
    team.members.push({
      position: row.position ?? team.members.length + 1,
      fullName: row.full_name ?? "",
      email: row.email ?? "",
      isLeader: row.is_leader ?? false,
    });
  }
  const list = [...teams.values()];
  for (const team of list) team.members.sort((a, b) => a.position - b.position);
  return list.sort(
    (a, b) =>
      a.registeredAt.localeCompare(b.registeredAt) || a.reference.localeCompare(b.reference),
  );
}

/** Case-insensitive match on reference, team, college, member names and emails. */
export function matchesSearch(team: TeamSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    team.reference,
    team.teamName,
    team.institution,
    team.leaderPhone,
    ...team.members.flatMap((m) => [m.fullName, m.email]),
  ];
  return haystack.some((value) => value.toLowerCase().includes(q));
}

/** "26 Nov 2026, 11:35 pm" in India time, for the console and the CSV. */
export function formatRegisteredAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * One CSV cell. Quotes every value and doubles inner quotes (RFC 4180). Values that a
 * spreadsheet would run as a formula (= + - @, tab, carriage return) get a leading apostrophe,
 * so a team name like "=HYPERLINK(...)" stays plain text (OWASP CSV injection guidance).
 */
export function csvCell(value: string | number | boolean): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const CSV_HEADER = [
  "Reference",
  "Team",
  "College",
  "Status",
  "Registered (IST)",
  "Member #",
  "Role",
  "Name",
  "Email",
  "Leader mobile",
] as const;

/** One row per member, so the file sorts and filters well in Excel or Google Sheets. */
export function registrationsCsv(teams: readonly TeamSummary[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const team of teams) {
    for (const m of team.members) {
      lines.push(
        [
          team.reference,
          team.teamName,
          team.institution,
          team.status,
          formatRegisteredAt(team.registeredAt),
          m.position,
          m.isLeader ? "Leader" : "Member",
          m.fullName,
          m.email,
          m.isLeader ? team.leaderPhone : "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  // Byte order mark so Excel opens the UTF-8 file with the right characters.
  return `﻿${lines.join("\r\n")}\r\n`;
}
