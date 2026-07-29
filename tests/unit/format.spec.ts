import { describe, expect, it } from "vitest";
import { brl, initials } from "../../apps/web/src/lib/format";

describe("format helpers used by the current frontend", () => {
  it("formats operational values as Brazilian currency", () => {
    expect(brl(0)).toContain("0,00");
    expect(brl(1234.56)).toContain("1.234,56");
  });

  it("derives compact avatar initials from a contact or operator name", () => {
    expect(initials("Admin E2E")).toBe("AE");
    expect(initials("Juliana Ferreira Souza")).toBe("JF");
    expect(initials("cliente")).toBe("C");
  });
});
