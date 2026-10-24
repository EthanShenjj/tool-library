import { describe, expect, it } from "vitest";
import { buildPreviewRange, extractSpreadsheetId, generatedColumnName, quoteSheetName } from "@/lib/google/range";

describe("Google Sheet range helpers", () => {
  it("extracts ids from links and direct input", () => {
    const id = "1abcdefghijklmnopqrstuvwxyz123456";
    expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
    expect(extractSpreadsheetId(id)).toBe(id);
    expect(extractSpreadsheetId("not a sheet")).toBe("");
  });

  it("quotes sheet names safely", () => {
    expect(quoteSheetName("CRM Data")).toBe("'CRM Data'");
    expect(quoteSheetName("Team's Data")).toBe("'Team''s Data'");
  });

  it("caps previews to 50 columns and 100 data rows", () => {
    expect(buildPreviewRange("Users", "A:ZZ", true)).toBe("'Users'!A1:AX101");
    expect(buildPreviewRange("Users", "C5:Z5000", false)).toBe("'Users'!C5:Z104");
  });

  it("rejects malformed ranges", () => {
    expect(() => buildPreviewRange("Users", "Z:A", true)).toThrow();
    expect(() => buildPreviewRange("Users", "A0:B3", true)).toThrow();
    expect(generatedColumnName(26)).toBe("AA");
  });
});
