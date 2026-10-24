import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountSchema } from "@/lib/validation/account";
import { decryptJson, encryptJson } from "@/lib/security";

const database = vi.hoisted(() => ({ values: vi.fn(), set: vi.fn(), returning: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    insert: () => ({ values: database.values }),
    update: () => ({ set: database.set }),
  }),
}));

import { readAccountPassword, saveAccount, summarizeAccount } from "@/lib/accounts";

const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
const input = { platform: "GitHub", websiteUrl: "https://github.com/login", username: "team@example.com", notes: "开发账号" };
const base = {
  id: "223d75ce-f1ca-4d3e-9c84-fde59cf094a9",
  platform: input.platform,
  websiteUrl: input.websiteUrl,
  createdAt: new Date("2026-10-22T00:00:00Z"),
  updatedAt: new Date("2026-10-22T00:00:00Z"),
};

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "ab".repeat(32);
  database.values.mockImplementation((values) => {
    database.returning.mockResolvedValue([{ ...base, ...values }]);
    return { returning: database.returning };
  });
  database.set.mockImplementation((values) => {
    database.returning.mockResolvedValue([{ ...base, ...values }]);
    return { where: () => ({ returning: database.returning }) };
  });
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  else process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
  vi.clearAllMocks();
});

describe("account validation", () => {
  it.each(["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:secret@example.com", "example.com"])("rejects unsafe or incomplete website URL %s", (websiteUrl) => {
    expect(accountSchema.safeParse({ ...input, websiteUrl }).success).toBe(false);
  });
  it("accepts optional websites and blank accounts while requiring a platform", () => {
    expect(accountSchema.safeParse({ ...input, websiteUrl: "" }).success).toBe(true);
    expect(accountSchema.safeParse({ ...input, platform: "  " }).success).toBe(false);
    expect(accountSchema.parse({ ...input, username: "  " }).username).toBe("");
  });

  it.each([["", ""], ["team", ""], ["", "secret"], ["team", "secret"]])("accepts username %s and an optional password", (username, password) => {
    expect(accountSchema.safeParse({ ...input, username, password }).success).toBe(true);
  });
});

describe("account encrypted persistence", () => {
  it("encrypts account details and never includes the password in summaries", async () => {
    const summary = await saveAccount({ ...input, password: " top-secret " });
    const values = database.values.mock.calls[0][0];
    expect(values).not.toHaveProperty("username");
    expect(values.encryptedPayload).not.toContain("top-secret");
    expect(decryptJson(values.encryptedPayload)).toEqual({ username: input.username, notes: input.notes, password: " top-secret " });
    expect(summary).toMatchObject({ ...input, hasPassword: true });
    expect(summary).not.toHaveProperty("password");
    expect(summary).not.toHaveProperty("encryptedPayload");
  });

  it("preserves an existing password when the edit omits it", async () => {
    const existing = { ...base, encryptedPayload: encryptJson({ ...input, password: "keep-me" }) };
    await saveAccount({ ...input, notes: "更新备注" }, existing);
    const values = database.set.mock.calls[0][0];
    expect(decryptJson(values.encryptedPayload)).toMatchObject({ password: "keep-me", notes: "更新备注" });
  });

  it("clears an existing password only when explicitly requested", async () => {
    const existing = { ...base, encryptedPayload: encryptJson({ ...input, password: "remove-me" }) };
    const summary = await saveAccount({ ...input, password: "" }, existing);
    expect(summary?.hasPassword).toBe(false);
    expect(decryptJson(database.set.mock.calls[0][0].encryptedPayload)).toMatchObject({ password: "" });
  });

  it("only reveals a password through the explicit password reader", () => {
    const account = { ...base, encryptedPayload: encryptJson({ ...input, password: "reveal-me" }) };
    expect(summarizeAccount(account)).not.toHaveProperty("password");
    expect(readAccountPassword(account)).toBe("reveal-me");
  });
});
