import { describe, expect, it } from "vitest";
import { event, teamSizeLabel, venueLabel } from "./event";

describe("event config", () => {
  it("keeps the agreed facts", () => {
    expect(event.prizePool).toBe(300_000);
    expect(event.team).toEqual({ minSize: 2, maxSize: 5 });
    expect(venueLabel).toBe("Jubilee Hills Convention Centre, Hyderabad");
    expect(teamSizeLabel).toBe("2 to 5 members");
  });

  it("does not carry guessed dates", () => {
    expect(event.startDate).toBeNull();
    expect(event.endDate).toBeNull();
    for (const entry of event.timeline) {
      expect(entry.date).toBeNull();
    }
  });
});
