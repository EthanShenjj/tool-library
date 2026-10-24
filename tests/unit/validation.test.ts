import { describe, expect, it } from "vitest";
import { toolManifestSchema } from "@/lib/tools/schema";
import { connectorSchema } from "@/lib/validation/connector";

const connector = {
  name: "CRM 用户标签",
  authMode: "oauth" as const,
  spreadsheetId: "1abcdefghijklmnopqrstuvwxyz123456",
  sheetUrl: "https://docs.google.com/spreadsheets/d/1abcdefghijklmnopqrstuvwxyz123456/edit",
  sheet: "Users",
  range: "A:Z",
  headerRow: true,
  primaryKey: "user_id",
  importMode: "upsert" as const,
  frequency: "daily" as const,
  scheduleTime: "03:00",
  timezone: "Asia/Shanghai" as const,
  fieldMapping: [{ source: "User ID", target: "user_id" }],
  testPassed: true,
};

describe("public input schemas", () => {
  it("accepts a valid connector", () => {
    expect(connectorSchema.parse(connector).name).toBe("CRM 用户标签");
  });

  it("rejects invalid ids and schedule values", () => {
    expect(connectorSchema.safeParse({ ...connector, spreadsheetId: "short" }).success).toBe(false);
    expect(connectorSchema.safeParse({ ...connector, scheduleTime: "25:00" }).success).toBe(false);
  });

  it("requires safe manifest entry contracts", () => {
    expect(toolManifestSchema.safeParse({ id: "demo", name: "Demo", description: "A useful tool", category: "数据", icon: "box", status: "ready", entry: { type: "internal", href: "/tools/demo" } }).success).toBe(true);
    expect(toolManifestSchema.safeParse({ id: "demo", name: "Demo", description: "A useful tool", category: "数据", icon: "box", status: "ready", entry: { type: "internal", href: "javascript:alert(1)" } }).success).toBe(false);
  });
});
