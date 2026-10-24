import { extensionCoreSource } from "../helpers/account-extension-source";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Message = { channel: string; action: string; input?: unknown; id?: string };
type Result = { ok: boolean; data?: { kind?: string; matches?: unknown[]; account?: unknown }; error?: { code: string; message: string } };
type Listener = (message: Message, sender: { id: string; tab?: unknown }, send: (response: Result) => void) => boolean | undefined;
const input = { platform: "Example", websiteUrl: "https://www.example.com/path", username: "", password: "", notes: "" };
const existing = { ...input, id: "223d75ce-f1ca-4d3e-9c84-fde59cf094a9", notes: "原备注", hasPassword: true };
const shared = extensionCoreSource;
const bridge = readFileSync("account-manager/extension/bridge.js", "utf8");
const fetchMock = vi.fn();
const notify = vi.fn();
let listener: Listener;
let callbacks: Listener[];
const envelope = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });

beforeEach(() => {
  fetchMock.mockReset();
  notify.mockReset();
  callbacks = [];
  const context = vm.createContext({ URL, Error, Event, window: { dispatchEvent: notify }, Set, AbortController, setTimeout, clearTimeout, fetch: fetchMock, location: { href: "https://team-toolbox.vercel.app/tools/account-manager" }, chrome: { runtime: { id: "test-extension", onMessage: { addListener: (callback: Listener) => callbacks.push(callback) } } } });
  vm.runInContext(shared, context);
  vm.runInContext(bridge, context);
  vm.runInContext(bridge, context);
  listener = callbacks[0];
});

function dispatch(action: string, extra: object = {}) {
  return new Promise<Result>((resolve) => listener({ channel: "ACCOUNT_CAPTURE_BRIDGE", action, ...extra }, { id: "test-extension" }, resolve));
}

describe("isolated account bridge", () => {
  it("installs only once and rejects foreign senders, pages, and unsupported operations", () => {
    expect(callbacks).toHaveLength(1);
    const send = vi.fn();
    expect(listener({ channel: "ACCOUNT_CAPTURE_BRIDGE", action: "CREATE", input }, { id: "other-extension" }, send)).toBeUndefined();
    expect(listener({ channel: "ACCOUNT_CAPTURE_BRIDGE", action: "CREATE", input }, { id: "test-extension", tab: { id: 1 } }, send)).toBeUndefined();
    for (const action of ["DELETE", "READ_PASSWORD", "FETCH_URL"]) listener({ channel: "ACCOUNT_CAPTURE_BRIDGE", action }, { id: "test-extension" }, send);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("reminds about all matches without writing or returning stored notes", async () => {
    fetchMock.mockResolvedValue(envelope({ accounts: [existing, { ...existing, id: "second" }] }));
    const result = await dispatch("SAVE", { input });
    expect(result.ok).toBe(true);
    expect(result.data?.kind).toBe("duplicates");
    expect(result.data?.matches).toHaveLength(2);
    expect(JSON.stringify(result.data?.matches)).not.toContain("原备注");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([["", ""], ["team", ""], ["", "secret"], ["team", "secret"]])("saves optional credentials with username %s", async (username, password) => {
    fetchMock.mockResolvedValueOnce(envelope({ accounts: [] })).mockResolvedValueOnce(envelope({ ...existing, username, hasPassword: Boolean(password) }, 201));
    const result = await dispatch("SAVE", { input: { ...input, username, password } });
    expect(result.data?.kind).toBe("saved");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ username, password });
    expect(result.data?.account).not.toHaveProperty("password");
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0][0].type).toBe("account-manager:changed");
    expect(notify.mock.calls[0][0]).not.toHaveProperty("detail");
  });

  it("allows an explicitly requested extra record", async () => {
    fetchMock.mockResolvedValue(envelope(existing, 201));
    expect((await dispatch("CREATE", { input })).data?.kind).toBe("saved");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("updates a freshly checked matching record and preserves empty password and notes", async () => {
    fetchMock.mockResolvedValueOnce(envelope({ accounts: [existing] })).mockResolvedValueOnce(envelope(existing));
    expect((await dispatch("UPDATE", { input, id: existing.id })).data?.kind).toBe("saved");
    const values = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(values.notes).toBe("原备注");
    expect(values).not.toHaveProperty("password");
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/accounts/${existing.id}`);
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
    expect(notify).toHaveBeenCalledOnce();
  });

  it("does not overwrite a record whose domain or account changed", async () => {
    fetchMock.mockResolvedValue(envelope({ accounts: [{ ...existing, username: "different" }] }));
    expect((await dispatch("UPDATE", { input, id: existing.id })).error?.code).toBe("STALE_MATCH");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("reports login expiry without following a redirect with credential data", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://vercel.com/login" } }));
    expect((await dispatch("CREATE", { input: { ...input, password: "dummy" } })).error?.code).toBe("AUTH_REQUIRED");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual", credentials: "same-origin", mode: "same-origin", cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a retryable error when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await dispatch("CHECK")).error?.code).toBe("NETWORK_ERROR");
  });

  it("maps an aborted fetch to a retryable connection message", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("Aborted"), { code: 20, name: "AbortError" }));
    expect((await dispatch("CHECK")).error?.code).toBe("NETWORK_ERROR");
  });
});
