import { describe, expect, it } from "vitest";
import { formatINR } from "@/lib/format-inr";

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(300000)).toBe("₹3,00,000");
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
  });

  it("formats small amounts without separators", () => {
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(999)).toBe("₹999");
  });

  it("rounds to whole rupees", () => {
    expect(formatINR(1499.6)).toBe("₹1,500");
  });

  it("rejects non-finite input", () => {
    expect(() => formatINR(Number.NaN)).toThrow(RangeError);
    expect(() => formatINR(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
