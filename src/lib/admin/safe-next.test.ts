import { describe, expect, it } from "vitest";
import { safeConsolePath } from "./safe-next";

describe("safeConsolePath", () => {
  it("allows only known console paths", () => {
    expect(safeConsolePath("/admin/export")).toBe("/admin/export");
    expect(safeConsolePath("/admin/statements")).toBe("/admin/statements");
    expect(safeConsolePath("/admin/statements/export")).toBe("/admin/statements/export");
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/admin/../x", "/"]) {
      expect(safeConsolePath(bad)).toBe("/admin");
    }
  });
});
