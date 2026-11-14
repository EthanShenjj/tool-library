"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type InputHTMLAttributes } from "react";
import { FileArchive, FileText, FolderOpen, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_SKILL_BYTES, MAX_SKILL_FILES, formatSkillSize, type SkillSummary } from "@/lib/skills/schema";
import { skillMessage, skillRequest } from "./client";

const folderAttributes = { webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>;

export function SkillUpload({ skill, onClose, onSaved }: { skill?: SkillSummary; onClose: () => void; onSaved: (skill: SkillSummary) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const size = files.reduce((sum, file) => sum + file.size, 0);

  function select(selected: File[]) {
    setError("");
    if (!selected.length) return;
    if (selected.length > MAX_SKILL_FILES) { setError(`每个技能包最多包含 ${MAX_SKILL_FILES} 个文件。`); return; }
    if (selected.reduce((sum, file) => sum + file.size, 0) > MAX_SKILL_BYTES) { setError("上传文件的总大小不能超过 3 MB。"); return; }
    if (selected.length === 1 && !selected[0].webkitRelativePath && !/^(SKILL\.md|.+\.zip)$/i.test(selected[0].name)) {
      setError("请选择 SKILL.md 或 ZIP；上传完整目录请使用「选择文件夹」。"); return;
    }
    setFiles(selected);
  }

  async function upload() {
    if (!files.length || saving) return;
    setSaving(true); setError("");
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("paths", JSON.stringify(files.map((file) => file.webkitRelativePath || file.name)));
    try { onSaved(await skillRequest<SkillSummary>(skill ? `/api/skills/${skill.id}` : "/api/skills", skill ? "PATCH" : "POST", form)); }
    catch (error) { setError(skillMessage(error)); }
    finally { setSaving(false); }
  }

  return <Dialog.Root open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-[#18212f]/40 backdrop-blur-[2px]" />
      <Dialog.Content aria-busy={saving} className="skill-dialog max-w-xl">
        <Dialog.Title className="pr-8 text-xl font-bold">{skill ? "更新技能包" : "上传 Skill"}</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm leading-6 text-[#667366]">{skill ? `替换「${skill.name}」的文件内容，保留已有名称、说明、标签、收藏和备注。` : "把常用技能存进工具库，自动读取名称与说明。每次上传一个 Skill。"}</Dialog.Description>
        <Dialog.Close asChild><Button variant="ghost" size="icon" disabled={saving} className="absolute right-4 top-4" aria-label="关闭"><X className="size-4" /></Button></Dialog.Close>
        <input ref={fileInput} type="file" accept=".zip,.md,application/zip" aria-label="选择 Skill 文件" className="sr-only" tabIndex={-1} disabled={saving} onChange={(event) => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <input ref={folderInput} type="file" multiple {...folderAttributes} aria-label="选择 Skill 文件夹" className="sr-only" tabIndex={-1} disabled={saving} onChange={(event) => { select(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <div onDragOver={(event) => { event.preventDefault(); if (!saving) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!saving) select(Array.from(event.dataTransfer.files)); }} className={`mt-6 rounded-xl border-2 border-dashed px-5 py-9 text-center ${dragging ? "border-[#3156d8] bg-[#edf1ff]" : "border-[#d4dcd1] bg-[#f7f9f6]"}`}>
          <span className="mx-auto grid size-12 place-items-center rounded-xl border border-[#dce1da] bg-white text-[#3156d8]"><Upload className="size-5" /></span>
          <p className="mt-4 text-sm font-bold">拖放 SKILL.md 或 ZIP 到这里</p>
          <p className="mt-2 text-xs leading-5 text-[#758174]">也可以选择完整技能文件夹，保留 scripts、references 和 assets。</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="primary" size="sm" disabled={saving} onClick={() => fileInput.current?.click()}><FileText className="size-3.5" />选择 ZIP / SKILL.md</Button><Button variant="secondary" size="sm" disabled={saving} onClick={() => folderInput.current?.click()}><FolderOpen className="size-3.5" />选择文件夹</Button></div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#758174]">上传及解压后均不超过 3 MB，最多 200 个文件。SKILL.md 不超过 256 KB。</p>
        {files.length > 0 && <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#dce1da] p-4"><FileArchive className="mt-0.5 size-5 shrink-0 text-[#3156d8]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{files[0].webkitRelativePath?.split("/")[0] || files[0].name}</p><p className="mt-1 text-xs text-[#758174]">{files.length} 个待上传文件 · {formatSkillSize(size)}</p></div><Button variant="ghost" size="icon" className="size-7" disabled={saving} aria-label="移除已选文件" onClick={() => setFiles([])}><X className="size-3.5" /></Button></div>}
        {error && <p role="alert" className="mt-4 text-sm leading-6 text-[#b84040]">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={onClose}>取消</Button><Button variant="primary" disabled={!files.length || saving} onClick={upload}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{saving ? "正在保存…" : skill ? "替换并保存" : "上传并保存"}</Button></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
