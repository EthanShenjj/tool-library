import { extensionCoreSource } from "../helpers/account-extension-source";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Message = { channel: string; type: string; input?: unknown };
type Result = { ok: boolean; data?: unknown; error?: { code: string; message: string } };
type Listener = (message: Message, sender: { id: string; url: string }, send: (response: Result) => void) => boolean | undefined;
const shared = extensionCoreSource;
const worker = readFileSync("account-manager/extension/service-worker.js", "utf8");
const toolUrl = "https://team-toolbox.vercel.app/tools/account-manager";
const input = { platform: "Example", websiteUrl: "https://example.com", username: "", password: "", notes: "" };
const tabs = { query: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), sendMessage: vi.fn() };
const executeScript = vi.fn();
const getWindows = vi.fn();
let listener: Listener;

beforeEach(() => {
  vi.resetAllMocks();
  const context = vm.createContext({ URL, Error, Set, Date, setTimeout, clearTimeout, chrome: {
    tabs,
    windows: { update: vi.fn().mockResolvedValue({}), getAll: getWindows },
    scripting: { executeScript },
    runtime: { id: "test", getURL: (path: string) => `chrome-extension://test/${path}`, onMessage: { addListener: (callback: Listener) => { listener = callback; } } },
  } });
  context.importScripts = () => vm.runInContext(shared, context);
  vm.runInContext(worker, context);
  tabs.query.mockResolvedValue([{ id: 10, url: toolUrl, status: "complete", windowId: 1 }]);
  tabs.sendMessage.mockResolvedValue({ ok: true, data: { connected: true } });
  getWindows.mockResolvedValue([]);
});

function dispatch(type: string, extra = {}) {
  return new Promise<Result>((resolve) => listener({ channel: "ACCOUNT_CAPTURE_POPUP", type, ...extra }, { id: "test", url: "chrome-extension://test/popup.html" }, resolve));
}

describe("Chrome capture service worker", () => {
  it("suggests the identified platform rather than just its hostname", async () => {
    tabs.query.mockResolvedValue([{ url: "https://creator.xiaohongshu.com/login?q=1" }]);
    expect((await dispatch("CAPTURE_CONTEXT")).data).toEqual({ url: "https://creator.xiaohongshu.com/login?q=1", platform: "小红书" });
  });
  it("captures only the active tab URL and domain", async () => {
    tabs.query.mockResolvedValue([{ id: 1, url: "https://www.example.com/path?q=1#section" }]);
    expect((await dispatch("CAPTURE_CONTEXT")).data).toEqual({ url: "https://www.example.com/path?q=1#section", platform: "example.com" });
    tabs.query.mockResolvedValue([{ id: 1, url: "chrome://extensions" }]);
    expect((await dispatch("CAPTURE_CONTEXT")).data).toEqual({ url: "", platform: "" });
  });

  it("reuses the tool tab and sends only a fixed bridge operation", async () => {
    expect((await dispatch("CHECK_CONNECTION")).ok).toBe(true);
    expect(tabs.create).not.toHaveBeenCalled();
    expect(tabs.sendMessage).toHaveBeenLastCalledWith(10, expect.objectContaining({ channel: "ACCOUNT_CAPTURE_BRIDGE", action: "CHECK" }), { frameId: 0 });
  });

  it("uses the popup owner window even when another browser window has focus", async () => {
    tabs.query.mockResolvedValue([{ url: "https://example.com/owner" }]);
    expect((await dispatch("CAPTURE_CONTEXT", { windowId: 8 })).data).toEqual({ url: "https://example.com/owner", platform: "example.com" });
    expect(tabs.query).toHaveBeenCalledWith({ active: true, windowId: 8 });
  });

  it("uses the focused normal browser window while the action popup owns transient focus", async () => {
    tabs.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 2, url: "https://example.com/login" }]);
    getWindows.mockResolvedValue([{ id: 4, focused: false }, { id: 5, focused: true }]);
    expect((await dispatch("CAPTURE_CONTEXT")).data).toEqual({ url: "https://example.com/login", platform: "example.com" });
    expect(tabs.query).toHaveBeenLastCalledWith({ active: true, windowId: 5 });
  });

  it("creates an inactive tool tab when none exists", async () => {
    tabs.query.mockResolvedValue([]);
    tabs.create.mockResolvedValue({ id: 20, url: toolUrl, status: "complete", windowId: 1 });
    expect((await dispatch("CHECK_CONNECTION")).ok).toBe(true);
    expect(tabs.create).toHaveBeenCalledWith({ url: toolUrl, active: false });
  });

  it("injects into pre-existing tool tabs without reloading them", async () => {
    tabs.sendMessage.mockRejectedValueOnce(new Error("No receiver"));
    tabs.sendMessage.mockResolvedValue({ ok: true, data: {} });
    expect((await dispatch("CHECK_CONNECTION")).ok).toBe(true);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 10 }, world: "ISOLATED", files: ["platforms.js", "shared.js", "bridge.js"] });
  });

  it("reports a redirected login tab without injecting into it", async () => {
    tabs.query.mockResolvedValue([]);
    tabs.create.mockResolvedValue({ id: 20, url: "https://vercel.com/login", status: "complete" });
    expect((await dispatch("CHECK_CONNECTION")).error?.code).toBe("AUTH_REQUIRED");
    expect(executeScript).not.toHaveBeenCalled();
  });

  it("rejects content-script senders and does not expose arbitrary requests", async () => {
    const send = vi.fn();
    expect(listener({ channel: "ACCOUNT_CAPTURE_POPUP", type: "CREATE_ACCOUNT", input }, { id: "test", url: toolUrl }, send)).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect((await dispatch("DELETE_ACCOUNT")).error?.code).toBe("INVALID_MESSAGE");
    expect(tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("serializes mutations so a second popup cannot double-save", async () => {
    let finish: (response: unknown) => void = () => {};
    tabs.sendMessage.mockImplementation(async (_id, message) => message.action === "PING" ? { ok: true, data: { ready: true } } : new Promise((resolve) => { finish = resolve; }));
    const first = dispatch("PREPARE_SAVE", { input });
    expect((await dispatch("PREPARE_SAVE", { input })).error?.code).toBe("BUSY");
    await vi.waitFor(() => expect(tabs.sendMessage).toHaveBeenCalledTimes(2));
    finish({ ok: true, data: { kind: "saved" } });
    expect((await first).ok).toBe(true);
  });
});
