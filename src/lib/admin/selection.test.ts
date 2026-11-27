import { describe, expect, it } from "vitest";
import {
  assignmentLabel,
  rankingLabel,
  selectionCsv,
  statementsWithRoom,
  teamsNeedingStatement,
  type SelectionTeam,
} from "./selection";

const team = (over: Partial<SelectionTeam>): SelectionTeam => ({
  reference: "FF27-0001",
  teamName: "Hawks",
  leaderName: "Asha Rao",
  ranking: [3, 1, 4, 2],
  submittedAt: "2027-03-10T04:32:13.120+00:00",
  assignedStatement: 3,
  assignedChoice: 1,
  assignedBy: null,
  ...over,
});

describe("labels", () => {
  it("formats rankings", () => {
    expect(rankingLabel([3, 1, 4, 2])).toBe("3 › 1 › 4 › 2");
    expect(rankingLabel(null)).toBe("");
  });

  it("says how a team got its statement", () => {
    expect(assignmentLabel(team({}))).toBe("1st choice");
    expect(assignmentLabel(team({ assignedChoice: 3, assignedStatement: 4 }))).toBe("3rd choice");
    expect(
      assignmentLabel(team({ assignedChoice: null, assignedBy: "o@example.com", ranking: null })),
    ).toBe("Assigned by hand");
    expect(assignmentLabel(team({ assignedStatement: null, assignedChoice: null }))).toBe(
      "Every choice full: assign by hand",
    );
    expect(
      assignmentLabel(
        team({ assignedStatement: null, assignedChoice: null, ranking: null, submittedAt: null }),
      ),
    ).toBe("Not submitted");
  });
});

describe("hand assignment helpers", () => {
  it("lists teams without a statement and statements with room", () => {
    const waiting = team({ reference: "FF27-0002", assignedStatement: null, assignedChoice: null });
    expect(teamsNeedingStatement([team({}), waiting])).toEqual([waiting]);
    expect(
      statementsWithRoom([
        { statementId: 1, slots: 19, assigned: 19 },
        { statementId: 2, slots: 19, assigned: 18 },
      ]).map((s) => s.statementId),
    ).toEqual([2]);
  });
});

describe("CSV files", () => {
  it("orders choices by submission time, never-submitted last, and defuses formulas", () => {
    const csv = selectionCsv(
      [
        team({
          reference: "FF27-0003",
          submittedAt: null,
          ranking: null,
          assignedStatement: null,
          assignedChoice: null,
        }),
        team({
          reference: "FF27-0002",
          teamName: "=HYPERLINK(1)",
          submittedAt: "2027-03-10T04:32:14.000+00:00",
        }),
        team({}),
      ],
      (id) => `Statement ${String(id)}`,
    );
    const rows = csv.trim().split("\r\n");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toContain('"FF27-0001"');
    expect(rows[2]).toContain(`"'=HYPERLINK(1)"`);
    expect(rows[3]).toContain('"FF27-0003"');
    expect(rows[1]).toContain('"Statement 3","1st choice"');
  });
});
