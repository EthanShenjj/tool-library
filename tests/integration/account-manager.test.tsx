// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountManager } from "@/components/account-manager/account-manager";
import type { AccountSummary } from "@/lib/validation/account";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const account: AccountSummary = {
  id: "223d75ce-f1ca-4d3e-9c84-fde59cf094a9",
  platform: "GitHub", websiteUrl: "https://github.com/login", username: "team@example.com", notes: "开发账号", hasPassword: true,
  createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z",
};
const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("account manager interactions", () => {
  it("recognizes an existing URL without rewriting its saved name and filters by purpose", () => {
    render(<AccountManager initialAccounts={[
      { ...account, platform: "团队代码账号" },
      { ...account, id: "other", platform: "内容账号", websiteUrl: "https://creator.xiaohongshu.com" },
    ]} storageError="" />);
    expect(screen.getByText("GitHub · 开发工具")).toBeVisible();
    expect(screen.getByRole("heading", { name: "团队代码账号" })).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "按用途分类筛选" }), { target: { value: "development" } });
    expect(screen.queryByRole("heading", { name: "内容账号" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "搜索账号" }), { target: { value: "社交内容" } });
    expect(screen.getByText("没有匹配的账号")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("combobox", { name: "按用途分类筛选" })).toHaveValue("");
    expect(screen.getByRole("heading", { name: "内容账号" })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("suggests a platform from a pasted URL while keeping a manually entered name", () => {
    render(<AccountManager initialAccounts={[]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "添加账号" }));
    fireEvent.change(screen.getByLabelText("网站 URL"), { target: { value: "https://github.com/login" } });
    expect(screen.getByLabelText(/平台名称/)).toHaveValue("GitHub");
    expect(screen.getByText("识别为 GitHub · 开发工具")).toBeVisible();
    fireEvent.change(screen.getByLabelText(/平台名称/), { target: { value: "我的账号" } });
    fireEvent.change(screen.getByLabelText("网站 URL"), { target: { value: "https://chatgpt.com" } });
    expect(screen.getByLabelText(/平台名称/)).toHaveValue("我的账号");
    expect(screen.getByText("识别为 ChatGPT · AI 工具")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "使用识别名称" }));
    expect(screen.getByLabelText(/平台名称/)).toHaveValue("ChatGPT");
  });

  it("saves a new account and displays the returned record", async () => {
    fetchMock.mockResolvedValue(ok(account));
    render(<AccountManager initialAccounts={[]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "添加账号" }));
    fireEvent.change(screen.getByLabelText(/平台名称/), { target: { value: "GitHub" } });
    fireEvent.change(screen.getByLabelText("网站 URL"), { target: { value: account.websiteUrl } });
    fireEvent.change(screen.getByLabelText(/^账号/), { target: { value: account.username } });
    fireEvent.change(screen.getByLabelText("密码", { exact: true }), { target: { value: "demo-password" } });
    fireEvent.click(screen.getByRole("button", { name: "保存账号" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    expect(screen.getByRole("link", { name: /github.com/ })).toHaveAttribute("href", account.websiteUrl);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ password: "demo-password", username: account.username });
    expect(screen.queryByText("demo-password")).not.toBeInTheDocument();
  });

  it("omits an untouched password on edit and keeps the dialog open on save failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: { message: "保存失败，请重试" } }) });
    render(<AccountManager initialAccounts={[account]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "编辑 GitHub 账号" }));
    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "新的备注" } });
    fireEvent.click(screen.getByRole("button", { name: "保存账号" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请重试"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("password");
    expect(screen.getByLabelText("备注")).toHaveValue("新的备注");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("filters by website and removes a record after confirmed deletion", async () => {
    fetchMock.mockResolvedValue(ok({ removed: true }));
    render(<AccountManager initialAccounts={[account]} storageError="" />);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索账号" }), { target: { value: "github.com" } });
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "搜索账号" }), { target: { value: "missing" } });
    expect(screen.getByText("没有匹配的账号")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    fireEvent.click(screen.getByRole("button", { name: "删除 GitHub 账号" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.getByText("从第一个平台账号开始")).toBeVisible());
    expect(fetchMock).toHaveBeenCalledWith(`/api/accounts/${account.id}`, expect.objectContaining({ method: "DELETE" }));
  });

  it("only fetches a password on demand and automatically hides it after 30 seconds", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(ok({ password: "on-demand-secret" }));
    render(<AccountManager initialAccounts={[account]} storageError="" />);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "显示 GitHub 密码" })); });
    expect(screen.getByText("on-demand-secret")).toBeVisible();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.queryByText("on-demand-secret")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "显示 GitHub 密码" })).toBeVisible();
  });

  it("saves a URL with no username or password and renders the empty account", async () => {
    fetchMock.mockResolvedValue(ok({ ...account, username: "", hasPassword: false }));
    render(<AccountManager initialAccounts={[]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "添加账号" }));
    fireEvent.change(screen.getByLabelText(/平台名称/), { target: { value: "GitHub" } });
    fireEvent.change(screen.getByLabelText("网站 URL"), { target: { value: account.websiteUrl } });
    fireEvent.click(screen.getByRole("button", { name: "保存账号" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("未填写账号")).toBeVisible();
    expect(screen.queryByRole("button", { name: "复制 GitHub 账号" })).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ username: "", password: "" });
  });

  it("refreshes on focus without losing the search filter or an open editor draft", async () => {
    fetchMock.mockResolvedValue(ok({ accounts: [account, { ...account, id: "second", username: "new-account" }] }));
    render(<AccountManager initialAccounts={[account]} storageError="" />);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索账号" }), { target: { value: "GitHub" } });
    fireEvent.click(screen.getByRole("button", { name: "编辑 GitHub 账号" }));
    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "未提交的草稿" } });
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getAllByRole("heading", { name: "GitHub", hidden: true })).toHaveLength(2));
    expect(screen.getByLabelText("备注")).toHaveValue("未提交的草稿");
    expect(screen.getByRole("textbox", { name: "搜索账号", hidden: true })).toHaveValue("GitHub");
  });

  it("does not let a stale focus refresh replace a newly saved account", async () => {
    let resolveRefresh: (value: ReturnType<typeof ok>) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    fetchMock.mockResolvedValueOnce(ok(account));
    render(<AccountManager initialAccounts={[]} storageError="" />);
    fireEvent.focus(window);
    fireEvent.click(screen.getByRole("button", { name: "添加账号" }));
    fireEvent.change(screen.getByLabelText(/平台名称/), { target: { value: "GitHub" } });
    fireEvent.change(screen.getByLabelText(/^账号/), { target: { value: account.username } });
    fireEvent.click(screen.getByRole("button", { name: "保存账号" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => resolveRefresh(ok({ accounts: [] })));
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeVisible();
  });

  it("refreshes a background tool page after an extension save while preserving its draft and search", async () => {
    fetchMock.mockResolvedValue(ok({ accounts: [account, { ...account, id: "second", username: "new-account" }] }));
    render(<AccountManager initialAccounts={[account]} storageError="" />);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索账号" }), { target: { value: "GitHub" } });
    fireEvent.click(screen.getByRole("button", { name: "编辑 GitHub 账号" }));
    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "未提交的草稿" } });
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    try {
      fireEvent(window, new Event("account-manager:changed"));
      await waitFor(() => expect(screen.getAllByRole("heading", { name: "GitHub", hidden: true })).toHaveLength(2));
      expect(screen.getByLabelText("备注")).toHaveValue("未提交的草稿");
      expect(screen.getByRole("textbox", { name: "搜索账号", hidden: true })).toHaveValue("GitHub");
    } finally { hidden.mockRestore(); }
  });
});
