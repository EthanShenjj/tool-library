import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ listAccounts: vi.fn(), saveAccount: vi.fn(), getAccount: vi.fn(), deleteAccount: vi.fn(), readAccountPassword: vi.fn() }));
vi.mock("@/lib/accounts", () => storage);

import { GET, POST } from "@/app/api/accounts/route";
import { PATCH, DELETE } from "@/app/api/accounts/[id]/route";
import { POST as revealPassword } from "@/app/api/accounts/[id]/password/route";

const id = "223d75ce-f1ca-4d3e-9c84-fde59cf094a9";
const input = { platform: "GitHub", websiteUrl: "https://github.com", username: "team", notes: "" };
const context = () => ({ params: Promise.resolve({ id }) });
const request = (method: string, body?: unknown, origin = "http://localhost:3000") => new Request(`http://localhost:3000/api/accounts/${id}`, {
  method,
  headers: { origin, "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeEach(() => vi.resetAllMocks());

describe("account API", () => {
  it("disables caching for account lists", async () => {
    storage.listAccounts.mockResolvedValue([]);
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ success: true, data: { accounts: [] } });
  });

  it("validates input before persisting", async () => {
    const response = await POST(request("POST", { ...input, websiteUrl: "javascript:alert(1)" }));
    expect(response.status).toBe(400);
    expect(storage.saveAccount).not.toHaveBeenCalled();
  });

  it("creates an account with a 201 response", async () => {
    storage.saveAccount.mockResolvedValue({ id, ...input, hasPassword: false });
    const response = await POST(request("POST", input));
    expect(response.status).toBe(201);
    expect(storage.saveAccount).toHaveBeenCalledWith(input);
  });

  it("does not replace an omitted password during edits", async () => {
    const existing = { id, encryptedPayload: "sealed" };
    storage.getAccount.mockResolvedValue(existing);
    storage.saveAccount.mockResolvedValue({ id, ...input, hasPassword: true });
    expect((await PATCH(request("PATCH", input), context())).status).toBe(200);
    expect(storage.saveAccount).toHaveBeenCalledWith(input, existing);
  });

  it("returns 404 for a missing account", async () => {
    storage.getAccount.mockResolvedValue(null);
    expect((await revealPassword(request("POST"), context())).status).toBe(404);
    expect(storage.readAccountPassword).not.toHaveBeenCalled();
    storage.deleteAccount.mockResolvedValue(null);
    expect((await DELETE(request("DELETE"), context())).status).toBe(404);
  });

  it("returns passwords only on explicit reveal and disables caching", async () => {
    storage.getAccount.mockResolvedValue({ id });
    storage.readAccountPassword.mockReturnValue("secret");
    const response = await revealPassword(request("POST"), context());
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ success: true, data: { password: "secret" } });
  });

  it("rejects cross-origin create, edit, delete, and reveal requests", async () => {
    const origin = "https://other.example";
    const responses = [
      await POST(request("POST", input, origin)),
      await PATCH(request("PATCH", input, origin), context()),
      await DELETE(request("DELETE", undefined, origin), context()),
      await revealPassword(request("POST", undefined, origin), context()),
    ];
    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403]);
    expect(storage.saveAccount).not.toHaveBeenCalled();
    expect(storage.getAccount).not.toHaveBeenCalled();
    expect(storage.deleteAccount).not.toHaveBeenCalled();
  });

  it("rejects malformed IDs before a database query", async () => {
    const response = await DELETE(request("DELETE"), { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(response.status).toBe(400);
    expect(storage.deleteAccount).not.toHaveBeenCalled();
  });

  it("never exposes database errors or query parameters", async () => {
    storage.saveAccount.mockRejectedValue(new Error("Query failed: password=private"));
    const response = await POST(request("POST", input));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
