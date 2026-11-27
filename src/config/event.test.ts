import { describe, expect, it } from "vitest";
import { event, teamSizeLabel, venueLabel } from "./event";

describe("event config", () => {
  it("keeps the agreed facts", () => {
    expect(event.prizePool).toBe(300_000);
    expect(event.team).toEqual({ minSize: 2, maxSize: 5 });
    expect(event.teamCount).toBe(75);
    expect(venueLabel).toBe("Jubilee Hills Convention Centre, Hyderabad");
    expect(teamSizeLabel).toBe("2 to 5 members");
  });

  it("carries the dates from the official event document", () => {
    expect(event.startDate).toBe("2027-03-20");
    expect(event.endDate).toBe("2027-03-21");
  });

  it("only dates timeline steps the event document dates", () => {
    const dated = event.timeline.filter((e) => e.date !== null).map((e) => e.title);
    expect(dated).toEqual(["The hackathon"]);
    for (const entry of event.timeline) {
      if (entry.date === null) expect(entry.dateLabel).toBe("Date TBA");
    }
  });
});
