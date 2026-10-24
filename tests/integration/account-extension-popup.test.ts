import { extensionCoreSource } from "../helpers/account-extension-source";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, within } from "@testing-library/react";

const html = readFileSync("account-manager/extension/popup.html", "utf8");
const shared = extensionCoreSource;
const popup = readFileSync("account-manager/extension/popup.js", "utf8");
const capture = { url: "https://www.example.com/login?q=1#section", platform: "example.com" };
const sender = vi.fn();
const waitFor = vi.waitFor;
let dom: JSDOM;
let ui: ReturnType<typeof within>;
const ok = (data: unknown) => ({ ok: true, data });

beforeEach(() => {
  sender.mockReset();
  sender.mockImplementation(async (message) => {
    if (message.type === "CAPTURE_CONTEXT") return ok(capture);
    if (message.type === "CHECK_CONNECTION") return ok({ connected: true });
    return ok({ kind: "saved", account: { id: "created" } });
  });
});

afterEach(() => dom?.window.close());

async function open() {
  dom = new JSDOM(html, { url: "chrome-extension://test/popup.html", runScripts: "outside-only" });
  Object.assign(dom.window, { chrome: { runtime: { sendMessage: sender }, windows: { getCurrent: async () => ({ id: 5 }) } } });
  dom.window.eval(shared);
  dom.window.eval(popup);
  ui = within(dom.window.document.body);
  await waitFor(() => expect(ui.getByText("已连接团队工具台")).toBeTruthy());
}

function input(id: string) {
  return dom.window.document.getElementById(id) as HTMLInputElement;
}

describe("Chrome capture popup", () => {
  it("recognizes platform and purpose on initial capture and preserves custom names on URL changes", async () => {
    sender.mockImplementation(async (message) => message.type === "CAPTURE_CONTEXT" ? ok({ url: "https://github.com/login", platform: "github.com" }) : ok({ connected: true }));
    await open();
    expect(input("platform").value).toBe("GitHub");
    expect(ui.getByText("识别为 GitHub · 开发工具")).toBeTruthy();
    fireEvent.input(input("websiteUrl"), { target: { value: "https://creator.xiaohongshu.com" } });
    expect(input("platform").value).toBe("小红书");
    expect(ui.getByText("识别为 小红书 · 社交内容")).toBeTruthy();
    fireEvent.input(input("platform"), { target: { value: "团队账号" } });
    fireEvent.input(input("websiteUrl"), { target: { value: "https://chatgpt.com" } });
    expect(input("platform").value).toBe("团队账号");
    expect(ui.getByText("识别为 ChatGPT · AI 工具")).toBeTruthy();
  });

  it("autofills the full URL and domain and sends blank credentials", async () => {
    await open();
    expect(input("websiteUrl").value).toBe(capture.url);
    expect(input("platform").value).toBe(capture.platform);
    expect(input("password").type).toBe("password");
    fireEvent.submit(dom.window.document.getElementById("account-form")!);
    await waitFor(() => expect(ui.getByText("已保存到账号管理").hidden).toBe(false));
    const request = sender.mock.calls.find(([message]) => message.type === "PREPARE_SAVE")![0];
    expect(request.input).toMatchObject({ websiteUrl: capture.url, username: "", password: "", notes: "" });
    expect(ui.getByRole("button", { name: "再存一个账号" })).toBeTruthy();
    expect(dom.window.document.getElementById("save")!.hidden).toBe(true);
  });

  it("keeps credentials after failure and prevents double submissions while saving", async () => {
    await open();
    let finish: (result: unknown) => void = () => {};
    sender.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.input(input("username"), { target: { value: "demo-user" } });
    fireEvent.input(input("password"), { target: { value: "demo-password" } });
    const form = dom.window.document.getElementById("account-form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(sender.mock.calls.filter(([message]) => message.type === "PREPARE_SAVE")).toHaveLength(1);
    finish({ ok: false, error: { code: "NETWORK_ERROR", message: "网络失败，请重试" } });
    await waitFor(() => expect(ui.getByRole("alert").textContent).toBe("网络失败，请重试"));
    expect(input("username").value).toBe("demo-user");
    expect(input("password").value).toBe("demo-password");
    expect((ui.getByRole("button", { name: "保存到账号管理" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("lets the user choose a duplicate to update, then clears the password on success", async () => {
    await open();
    sender.mockResolvedValueOnce(ok({ kind: "duplicates", matches: [
      { id: "first", platform: "Example", username: "", websiteUrl: "https://example.com/a" },
      { id: "second", platform: "Example", username: "", websiteUrl: "https://example.com/b" },
    ] }));
    fireEvent.input(input("password"), { target: { value: "demo-password" } });
    fireEvent.submit(dom.window.document.getElementById("account-form")!);
    await waitFor(() => expect((ui.getByRole("button", { name: "更新已有记录" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(dom.window.document.getElementById("match")!, { target: { value: "second" } });
    fireEvent.click(ui.getByRole("button", { name: "更新已有记录" }));
    await waitFor(() => expect(ui.getByText("已更新到账号管理").hidden).toBe(false));
    expect(sender.mock.calls.find(([message]) => message.type === "UPDATE_ACCOUNT")![0].id).toBe("second");
    expect(input("password").value).toBe("");
  });

  it("supports saving another record and clears stale duplicate choices when fields change", async () => {
    await open();
    const duplicate = ok({ kind: "duplicates", matches: [{ id: "first", platform: "Example", username: "", websiteUrl: "https://example.com" }] });
    sender.mockResolvedValueOnce(duplicate);
    fireEvent.submit(dom.window.document.getElementById("account-form")!);
    await waitFor(() => expect(ui.getByRole("button", { name: "另存一条" })).toBeTruthy());
    fireEvent.input(input("username"), { target: { value: "changed" } });
    expect(dom.window.document.getElementById("duplicates")!.hidden).toBe(true);
    sender.mockResolvedValueOnce(duplicate);
    fireEvent.submit(dom.window.document.getElementById("account-form")!);
    await waitFor(() => expect((ui.getByRole("button", { name: "另存一条" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(ui.getByRole("button", { name: "另存一条" }));
    await waitFor(() => expect(sender.mock.calls.some(([message]) => message.type === "CREATE_ACCOUNT")).toBe(true));
  });

  it("keeps manual URL entry available on restricted pages", async () => {
    sender.mockImplementation(async (message) => message.type === "CAPTURE_CONTEXT" ? ok({ url: "", platform: "" }) : ok({ connected: true }));
    await open();
    expect(input("websiteUrl").value).toBe("");
    expect(ui.getByText(/当前页面不支持自动获取网址/)).toBeTruthy();
    expect(input("websiteUrl").disabled).toBe(false);
  });

  it("directs expired sessions to tool login without sending credentials", async () => {
    sender.mockImplementation(async (message) => message.type === "CAPTURE_CONTEXT" ? ok(capture) : { ok: false, error: { code: "AUTH_REQUIRED", message: "请先登录工具台" } });
    dom = new JSDOM(html, { url: "chrome-extension://test/popup.html", runScripts: "outside-only" });
    Object.assign(dom.window, { chrome: { runtime: { sendMessage: sender }, windows: { getCurrent: async () => ({ id: 5 }) } } });
    dom.window.eval(shared);
    dom.window.eval(popup);
    ui = within(dom.window.document.body);
    await waitFor(() => expect(ui.getByRole("button", { name: "前往登录" })).toBeTruthy());
    expect((ui.getByRole("button", { name: "连接工具台后保存" }) as HTMLButtonElement).disabled).toBe(true);
    sender.mockResolvedValueOnce(ok({ opened: true }));
    fireEvent.click(ui.getByRole("button", { name: "前往登录" }));
    await waitFor(() => expect(sender.mock.calls.at(-1)![0].type).toBe("OPEN_MANAGER"));
    expect(sender.mock.calls.every(([message]) => !message.input)).toBe(true);
  });

  it("focuses and marks an invalid URL without sending a save or losing credentials", async () => {
    await open();
    fireEvent.input(input("password"), { target: { value: "keep-me" } });
    fireEvent.input(input("websiteUrl"), { target: { value: "bad-url" } });
    fireEvent.submit(dom.window.document.getElementById("account-form")!);
    expect(dom.window.document.activeElement).toBe(input("websiteUrl"));
    expect(input("websiteUrl").getAttribute("aria-invalid")).toBe("true");
    expect(input("password").value).toBe("keep-me");
    expect(sender.mock.calls.some(([message]) => message.type === "PREPARE_SAVE")).toBe(false);
    fireEvent.input(input("websiteUrl"), { target: { value: capture.url } });
    expect(input("websiteUrl").hasAttribute("aria-invalid")).toBe(false);
  });

  it("keeps a duplicate selection when editing password or notes, and requires an explicit choice on Enter", async () => {
    await open();
    sender.mockResolvedValueOnce(ok({ kind: "duplicates", matches: [
      { id: "first", platform: "Example", username: "", websiteUrl: "https://example.com/a" },
      { id: "second", platform: "Example", username: "", websiteUrl: "https://example.com/b", hasPassword: true },
    ] }));
    fireEvent.submit(dom.window.document.getElementById("account-form")!);
    await waitFor(() => expect(ui.getByText("找到 2 条重复记录")).toBeTruthy());
    fireEvent.change(input("match"), { target: { value: "second" } });
    fireEvent.input(input("password"), { target: { value: "changed-password" } });
    fireEvent.input(input("notes"), { target: { value: "changed-notes" } });
    expect(input("match").value).toBe("second");
    expect(ui.getByText(/https:\/\/example.com\/b · 已存密码/)).toBeTruthy();
    const before = sender.mock.calls.length;
    fireEvent.submit(dom.window.document.getElementById("account-form")!);
    fireEvent.keyDown(dom.window.document, { key: "Enter", ctrlKey: true });
    expect(sender.mock.calls).toHaveLength(before);
    expect(dom.window.document.activeElement).toBe(dom.window.document.getElementById("duplicate-heading"));
  });

  it("saves with the keyboard and starts a fresh account while keeping the website", async () => {
    await open();
    fireEvent.input(input("username"), { target: { value: "first-account" } });
    fireEvent.input(input("password"), { target: { value: "secret" } });
    fireEvent.input(input("notes"), { target: { value: "private-note" } });
    fireEvent.click(ui.getByRole("button", { name: "显示密码" }));
    fireEvent.keyDown(dom.window.document, { key: "Enter", metaKey: true });
    await waitFor(() => expect(ui.getByText("已保存到账号管理").hidden).toBe(false));
    expect(input("password").value).toBe("");
    expect(input("password").type).toBe("password");
    const savedCalls = sender.mock.calls.length;
    fireEvent.keyDown(dom.window.document, { key: "Enter", ctrlKey: true });
    expect(sender.mock.calls).toHaveLength(savedCalls);
    fireEvent.click(ui.getByRole("button", { name: "再存一个账号" }));
    for (const id of ["username", "password", "notes"]) expect(input(id).value).toBe("");
    expect(input("websiteUrl").value).toBe(capture.url);
    expect(input("platform").value).toBe(capture.platform);
    expect(dom.window.document.activeElement).toBe(input("username"));
    expect((ui.getByRole("button", { name: "保存到账号管理" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("restores the captured URL and updates an automatic platform without overwriting a custom name", async () => {
    await open();
    fireEvent.input(input("websiteUrl"), { target: { value: "https://other.example.com/login" } });
    expect(input("platform").value).toBe("other.example.com");
    fireEvent.input(input("platform"), { target: { value: "我的平台" } });
    fireEvent.click(ui.getByRole("button", { name: "恢复当前网页" }));
    expect(input("websiteUrl").value).toBe(capture.url);
    expect(input("platform").value).toBe("我的平台");
    expect(dom.window.document.getElementById("restore-url")!.hidden).toBe(true);
  });

  it("does not overwrite edits made before automatic capture completes", async () => {
    let finish: (result: unknown) => void = () => {};
    sender.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const opening = open();
    fireEvent.input(input("websiteUrl"), { target: { value: "https://manual.example.com" } });
    fireEvent.input(input("platform"), { target: { value: "手填平台" } });
    await waitFor(() => expect(sender).toHaveBeenCalled());
    finish(ok(capture));
    await opening;
    expect(input("websiteUrl").value).toBe("https://manual.example.com");
    expect(input("platform").value).toBe("手填平台");
  });

  it("rehides a revealed password when the popup loses focus without discarding the input", async () => {
    await open();
    fireEvent.input(input("password"), { target: { value: "secret" } });
    fireEvent.click(ui.getByRole("button", { name: "显示密码" }));
    expect(input("password").type).toBe("text");
    dom.window.dispatchEvent(new dom.window.Event("blur"));
    expect(input("password").type).toBe("password");
    expect(input("password").value).toBe("secret");
  });

});
