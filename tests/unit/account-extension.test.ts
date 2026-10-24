import { extensionCoreSource } from "../helpers/account-extension-source";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type Input = { platform: string; websiteUrl: string; username: string; password?: string; notes: string };
type Account = Input & { id: string; hasPassword: boolean };
type Core = {
  validWebsite: (value: unknown) => boolean;
  domain: (value: string) => string;
  isToolPage: (value: string) => boolean;
  validateInput: (input: Input) => Input;
  findMatches: (accounts: Account[], input: Input) => Account[];
  updateInput: (input: Input, existing: Account) => Input;
};

const context = vm.createContext({ URL, Error });
vm.runInContext(extensionCoreSource, context);
const core = context.AccountCapture as Core;
const input = { platform: "Example", websiteUrl: "https://www.EXAMPLE.com/path?q=1#section", username: " team ", password: "", notes: "" };
const existing = { ...input, id: "existing", username: "team", notes: "保留的备注", hasPassword: true };

describe("Chrome capture validation and duplicate rules", () => {
  it("keeps the complete URL while trimming non-secret fields", () => {
    expect(core.validateInput({ ...input, platform: " Example ", password: " secret " })).toMatchObject({
      platform: "Example", websiteUrl: input.websiteUrl, username: "team", password: " secret ",
    });
  });

  it.each([["", ""], ["team", ""], ["", "secret"], ["team", "secret"]])("allows optional credentials (%s)", (username, password) => {
    expect(core.validateInput({ ...input, username, password })).toMatchObject({ username, password });
  });

  it.each(["chrome://extensions", "about:blank", "file:///tmp/test", "javascript:alert(1)", "https://user:password@example.com", "example.com"])("rejects unsupported URL %s", (websiteUrl) => {
    expect(core.validWebsite(websiteUrl)).toBe(false);
    expect(() => core.validateInput({ ...input, websiteUrl })).toThrow();
  });

  it("matches domains ignoring www, case, scheme, paths, queries and fragments", () => {
    const accounts = [existing, { ...existing, id: "second", websiteUrl: "http://example.com/other" }, { ...existing, id: "subdomain", websiteUrl: "https://accounts.example.com" }, { ...existing, id: "different-user", username: "Team" }];
    expect(core.findMatches(accounts, input).map((account) => account.id)).toEqual(["existing", "second"]);
    expect(core.findMatches([{ ...existing, username: "" }], { ...input, username: "  " })).toHaveLength(1);
  });

  it("preserves blank update fields but accepts nonempty replacements", () => {
    const update = core.updateInput(input, existing);
    expect(update.notes).toBe(existing.notes);
    expect(update).not.toHaveProperty("password");
    expect(core.updateInput({ ...input, password: "new", notes: "new note" }, existing)).toMatchObject({ password: "new", notes: "new note" });
  });

  it("restricts the bridge to the exact account manager origin and route", () => {
    expect(core.isToolPage("https://team-toolbox.vercel.app/tools/account-manager?test=1")).toBe(true);
    expect(core.isToolPage("https://team-toolbox.vercel.app/tools/account-manager-other")).toBe(false);
    expect(core.isToolPage("https://team-toolbox.vercel.app.evil.com/tools/account-manager")).toBe(false);
    expect(core.isToolPage("http://team-toolbox.vercel.app/tools/account-manager")).toBe(false);
  });
});
