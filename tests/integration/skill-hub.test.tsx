// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SkillHub } from "@/components/skill-hub/skill-hub";
import type { SkillSummary } from "@/lib/skills/schema";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
const skill: SkillSummary = { id: "223d75ce-f1ca-4d3e-9c84-fde59cf094a9", name: "weekly-review", description: "每周工作复盘", tags: ["复盘"], notes: "周五使用", favorite: false, sourceName: "weekly-review.zip", files: [{ path: "SKILL.md", size: 256 }, { path: "scripts/run.sh", size: 20 }], totalBytes: 276, createdAt: "2026-11-14T00:00:00Z", updatedAt: "2026-11-14T00:00:00Z" };
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("Skill Hub interactions", () => {
  it("filters by notes, tags and favorites and resets to the full list", () => {
    render(<SkillHub initialSkills={[skill]} storageError="" />);
    fireEvent.change(screen.getByRole("textbox", { name: "搜索 Skill" }), { target: { value: "周五" } });
    expect(screen.getByRole("heading", { name: "weekly-review" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /我的收藏\s*0/ }));
    expect(screen.getByText("没有找到匹配的 Skill")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "查看全部 Skill" }));
    expect(screen.getByRole("textbox", { name: "搜索 Skill" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /#\s*复盘\s*1/ }));
    expect(screen.getByRole("heading", { name: "weekly-review" })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a ZIP, shows it in the management list and closes the dialog", async () => {
    fetchMock.mockResolvedValue(ok(skill));
    render(<SkillHub initialSkills={[]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "上传第一个 Skill" }));
    fireEvent.change(screen.getByLabelText("选择 Skill 文件"), { target: { files: [new File(["zip content"], "weekly-review.zip")] } });
    fireEvent.click(screen.getByRole("button", { name: "上传并保存" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "weekly-review" })).toBeVisible();
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.getAll("files")).toHaveLength(1);
    expect(form.get("paths")).toBe('["weekly-review.zip"]');
    expect(screen.getByRole("list", { name: "已保存的 Skill" })).toBeVisible();
    expect(screen.getByRole("button", { name: "编辑 weekly-review" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下载 weekly-review" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "删除 weekly-review" })).toBeEnabled();
  });

  it("preserves selected files and surfaces an upload error for retry", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: { message: "没有找到 SKILL.md" } }) });
    render(<SkillHub initialSkills={[]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "上传第一个 Skill" }));
    fireEvent.change(screen.getByLabelText("选择 Skill 文件"), { target: { files: [new File(["data"], "broken.zip")] } });
    fireEvent.click(screen.getByRole("button", { name: "上传并保存" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("没有找到 SKILL.md"));
    expect(screen.getByText("broken.zip")).toBeVisible();
    expect(screen.getByRole("button", { name: "上传并保存" })).toBeEnabled();
  });

  it("edits searchable metadata and deduplicates comma-separated tags", async () => {
    fetchMock.mockResolvedValue(ok({ ...skill, notes: "每周一使用", tags: ["复盘", "工作"] }));
    render(<SkillHub initialSkills={[skill]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "编辑 weekly-review" }));
    fireEvent.change(screen.getByLabelText("标签"), { target: { value: "复盘, 工作, 复盘" } });
    fireEvent.change(screen.getByLabelText("使用备注"), { target: { value: "每周一使用" } });
    fireEvent.click(screen.getByRole("button", { name: "保存信息" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ tags: ["复盘", "工作"], notes: "每周一使用" });
  });

  it("loads instructions only when requested and displays attached files", async () => {
    fetchMock.mockResolvedValue(ok({ ...skill, content: "# Instructions\nUse weekly" }));
    render(<SkillHub initialSkills={[skill]} storageError="" />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "查看 Skill" }));
    await waitFor(() => expect(screen.getByText(/# Instructions/)).toBeVisible());
    fireEvent.click(screen.getByRole("tab", { name: "文件 · 2" }));
    expect(screen.getByText("scripts/run.sh")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "更新技能包" }));
    expect(screen.getByRole("button", { name: "替换并保存" })).toBeDisabled();
    expect(screen.getByText(/保留已有名称/)).toBeVisible();
  });

  it("persists favorites and deletes only after confirmation", async () => {
    fetchMock.mockResolvedValueOnce(ok({ ...skill, favorite: true })).mockResolvedValueOnce(ok({ removed: true }));
    render(<SkillHub initialSkills={[skill]} storageError="" />);
    fireEvent.click(screen.getByRole("button", { name: "收藏 weekly-review" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "取消收藏 weekly-review" })).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "删除 weekly-review" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(screen.getByText("你的下一个好用技能，从这里开始")).toBeVisible());
  });

  it("explains unavailable storage and prevents unsavable uploads", () => {
    render(<SkillHub initialSkills={[]} storageError="请配置 DATABASE_URL" />);
    expect(screen.getByRole("alert")).toHaveTextContent("DATABASE_URL");
    expect(screen.getByRole("button", { name: "上传 Skill" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "上传第一个 Skill" })).toBeDisabled();
  });
});
