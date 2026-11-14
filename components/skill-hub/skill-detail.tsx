"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type FormEvent } from "react";
import { Copy, Download, FileText, FolderOpen, Loader2, Pencil, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSkillSize, skillMetadataSchema, type SkillDetail, type SkillSummary } from "@/lib/skills/schema";
import { downloadSkill, skillMessage, skillRequest } from "./client";

export function SkillDetailDialog({ skill, onClose, onEdit, onReplace }: { skill: SkillSummary; onClose: () => void; onEdit: () => void; onReplace: () => void }) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState<"content" | "files">("content");
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    skillRequest<SkillDetail>(`/api/skills/${skill.id}`, "GET", undefined, controller.signal)
      .then((value) => { if (!controller.signal.aborted) { setDetail(value); setError(""); } })
      .catch((error) => { if (!controller.signal.aborted) setError(skillMessage(error)); });
    return () => controller.abort();
  }, [skill.id, retry]);

  async function download() {
    setDownloading(true);
    try { await downloadSkill(skill.id, skill.name); }
    catch (error) { toast.error(skillMessage(error)); }
    finally { setDownloading(false); }
  }
  async function copy() {
    if (!detail) return;
    try { await navigator.clipboard.writeText(detail.content); toast.success("SKILL.md 已复制"); }
    catch { toast.error("复制失败，请检查浏览器剪贴板权限。"); }
  }

  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-[#18212f]/40 backdrop-blur-[2px]" />
    <Dialog.Content className="skill-dialog max-w-3xl">
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-[#dce1da] bg-[#f4f6f2] text-[#3156d8]"><FileText className="size-5" /></div>
      <Dialog.Title className="break-words pr-8 text-2xl font-bold tracking-tight">{skill.name}</Dialog.Title>
      <Dialog.Description className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#667366]">{skill.description || "暂未添加说明"}</Dialog.Description>
      <Dialog.Close asChild><Button variant="ghost" size="icon" className="absolute right-4 top-4" aria-label="关闭"><X className="size-4" /></Button></Dialog.Close>
      {skill.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{skill.tags.map((tag) => <span key={tag} className="skill-tag">{tag}</span>)}</div>}
      <div className="mt-5 flex flex-wrap items-center gap-2"><Button variant="primary" size="sm" disabled={downloading} onClick={download}>{downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}下载技能包</Button><Button variant="secondary" size="sm" disabled={!detail} onClick={copy}><Copy className="size-3.5" />复制 SKILL.md</Button><Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="size-3.5" />编辑信息</Button><Button variant="ghost" size="sm" onClick={onReplace}><RefreshCw className="size-3.5" />更新技能包</Button></div>
      <p className="mt-3 text-xs leading-5 text-[#7a8679]">下载后解压，将整个技能文件夹放入所用 AI 工具的 skills 目录。</p>
      {skill.notes && <div className="mt-5 rounded-xl border border-[#e7dfc6] bg-[#faf8ef] p-4"><p className="text-xs font-bold text-[#827243]">使用备注</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#6e653f]">{skill.notes}</p></div>}
      <div className="mt-6 flex gap-5 border-b border-[#dce1da]" role="tablist" aria-label="Skill 内容">
        <button id="skill-content-tab" role="tab" aria-selected={tab === "content"} aria-controls="skill-content-panel" tabIndex={tab === "content" ? 0 : -1} className={`skill-tab ${tab === "content" ? "skill-tab-active" : ""}`} onClick={() => setTab("content")} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { setTab("files"); document.getElementById("skill-files-tab")?.focus(); } }}><FileText className="size-3.5" />SKILL.md</button>
        <button id="skill-files-tab" role="tab" aria-selected={tab === "files"} aria-controls="skill-files-panel" tabIndex={tab === "files" ? 0 : -1} className={`skill-tab ${tab === "files" ? "skill-tab-active" : ""}`} onClick={() => setTab("files")} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { setTab("content"); document.getElementById("skill-content-tab")?.focus(); } }}><FolderOpen className="size-3.5" />文件 · {skill.files.length}</button>
      </div>
      {tab === "content" ? <div id="skill-content-panel" role="tabpanel" aria-labelledby="skill-content-tab" tabIndex={0} className="mt-4">
        {error ? <div className="rounded-xl bg-[#faf0f0] p-5 text-sm text-[#b84040]" role="alert">{error}<Button variant="secondary" size="sm" className="ml-3" onClick={() => { setError(""); setRetry((value) => value + 1); }}>重新加载</Button></div> : detail ? <pre className="max-h-[42dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#e4e8e1] bg-[#f7f9f6] p-5 font-mono text-xs leading-6 text-[#435044]">{detail.content}</pre> : <div className="flex h-40 items-center justify-center gap-2 text-sm text-[#758174]" role="status"><Loader2 className="size-4 animate-spin" />正在读取内容…</div>}
      </div> : <div id="skill-files-panel" role="tabpanel" aria-labelledby="skill-files-tab" tabIndex={0} className="mt-4 max-h-[42dvh] overflow-auto rounded-xl border border-[#e4e8e1]"><ul className="divide-y divide-[#e4e8e1]">{skill.files.map((file) => <li key={file.path} className="flex items-center gap-3 px-4 py-3"><FileText className="size-4 shrink-0 text-[#7a8679]" /><span className="min-w-0 flex-1 break-all font-mono text-xs">{file.path}</span><span className="shrink-0 text-xs text-[#7a8679]">{formatSkillSize(file.size)}</span></li>)}</ul></div>}
      <p className="mt-4 break-all text-xs text-[#7a8679]">来源：{skill.sourceName} · {formatSkillSize(skill.totalBytes)} · 更新于 {new Date(skill.updatedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

export function SkillEditor({ skill, onClose, onSaved }: { skill: SkillSummary; onClose: () => void; onSaved: (skill: SkillSummary) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = skillMetadataSchema.safeParse({ name: form.get("name"), description: form.get("description"), tags: String(form.get("tags") ?? "").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), notes: form.get("notes"), favorite: skill.favorite });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true); setError("");
    try { onSaved(await skillRequest<SkillSummary>(`/api/skills/${skill.id}`, "PATCH", parsed.data)); }
    catch (error) { setError(skillMessage(error)); }
    finally { setSaving(false); }
  }
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-[#18212f]/40 backdrop-blur-[2px]" />
    <Dialog.Content aria-busy={saving} className="skill-dialog max-w-xl">
      <Dialog.Title className="pr-8 text-xl font-bold">编辑 Skill 信息</Dialog.Title>
      <Dialog.Description className="mt-2 text-sm leading-6 text-[#667366]">整理名称、标签和使用心得。这里的信息用于检索，技能包中的原始文件会保留。</Dialog.Description>
      <Dialog.Close asChild><Button variant="ghost" size="icon" disabled={saving} className="absolute right-4 top-4" aria-label="关闭"><X className="size-4" /></Button></Dialog.Close>
      <form onSubmit={submit} className="mt-6"><fieldset disabled={saving} className="space-y-4">
        <div><label htmlFor="skill-name" className="form-label">名称 <span className="text-[#b84040]">*</span></label><Input id="skill-name" name="name" required maxLength={100} defaultValue={skill.name} /></div>
        <div><label htmlFor="skill-description" className="form-label">用途说明</label><textarea id="skill-description" name="description" maxLength={2000} defaultValue={skill.description} className="form-textarea min-h-24 font-sans! text-sm!" placeholder="这个 Skill 能帮你完成什么？" /></div>
        <div><label htmlFor="skill-tags" className="form-label">标签</label><Input id="skill-tags" name="tags" defaultValue={skill.tags.join(", ")} placeholder="例如：内容创作, 产品设计, 日常工作" /><p className="form-hint">用逗号分隔，最多 12 个标签，每个标签不超过 32 字。</p></div>
        <div><label htmlFor="skill-notes" className="form-label">使用备注</label><textarea id="skill-notes" name="notes" maxLength={5000} defaultValue={skill.notes} className="form-textarea min-h-24 font-sans! text-sm!" placeholder="记下适用场景、使用技巧或踩过的坑…" /></div>
      </fieldset>{error && <p role="alert" className="mt-4 text-sm text-[#b84040]">{error}</p>}<div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>取消</Button><Button variant="primary" type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "保存中…" : "保存信息"}</Button></div></form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
