"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpRight, ChevronRight, Download, FileText, Library, Loader2, Pencil, Search, SlidersHorizontal, Star, Tag, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatSkillSize, type SkillSummary } from "@/lib/skills/schema";
import { cn } from "@/lib/utils";
import { downloadSkill, skillMessage, skillRequest } from "./client";
import { SkillUpload } from "./skill-upload";
import { SkillDetailDialog, SkillEditor } from "./skill-detail";

type ActiveDialog = { type: "upload"; skill?: SkillSummary } | { type: "detail" | "edit"; skill: SkillSummary } | null;

export function SkillHub({ initialSkills, storageError, storageMode = "database" }: { initialSkills: SkillSummary[]; storageError: string; storageMode?: "local" | "database" }) {
  const [skills, setSkills] = useState(initialSkills);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("updated");
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const keyword = query.trim().toLowerCase();
  const tags = [...new Set(skills.flatMap((skill) => skill.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const favorites = skills.filter((skill) => skill.favorite).length;
  const visible = skills.filter((skill) => (filter !== "favorites" || skill.favorite) && (!tag || skill.tags.includes(tag)) && (!keyword || `${skill.name} ${skill.description} ${skill.tags.join(" ")} ${skill.notes} ${skill.sourceName}`.toLowerCase().includes(keyword)))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "zh-CN") : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  function saved(skill: SkillSummary) {
    setSkills((current) => [skill, ...current.filter((item) => item.id !== skill.id)]);
    if (dialog?.type === "upload" && !dialog.skill) reset();
    setDialog(null);
    toast.success("Skill 已保存");
  }
  async function act(skill: SkillSummary, action: "favorite" | "delete" | "download") {
    if (busyIds.has(skill.id)) return;
    setBusyIds((current) => new Set(current).add(skill.id));
    try {
      if (action === "download") await downloadSkill(skill.id, skill.name);
      else if (action === "favorite") {
        const updated = await skillRequest<SkillSummary>(`/api/skills/${skill.id}`, "PATCH", { favorite: !skill.favorite });
        setSkills((current) => current.map((item) => item.id === updated.id ? updated : item));
      } else {
        await skillRequest(`/api/skills/${skill.id}`, "DELETE");
        setSkills((current) => current.filter((item) => item.id !== skill.id));
        toast.success("Skill 已删除");
      }
    } catch (error) { toast.error(skillMessage(error)); }
    finally { setBusyIds((current) => { const next = new Set(current); next.delete(skill.id); return next; }); }
  }
  function reset() { setQuery(""); setFilter("all"); setTag(""); }

  return <main className="workspace-shell">
    <nav className="workspace-nav" aria-label="面包屑"><Link href="/" className="hover:text-[#3156d8]">工具目录</Link><ChevronRight className="size-3.5" /><span className="text-[#18212f]">Skill Hub</span></nav>
    <section className="flex flex-col gap-6 border-b border-[#dce1da] pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-4 flex items-center gap-2 text-xs font-bold tracking-[.12em] text-[#697767]"><Library className="size-4 text-[#3156d8]" />YOUR SKILLS, WITHIN REACH</div><h1 className="workspace-title">Skill Hub<span className="ml-3 inline-block size-2.5 rounded-full bg-[#3156d8] align-baseline" /></h1><p className="mt-4 text-sm leading-7 text-[#667366]">沉淀常用技能，让每一次好用的经验都能复用。</p></div>
      <Button variant="primary" size="lg" disabled={Boolean(storageError)} onClick={() => setDialog({ type: "upload" })}><Upload className="size-4" />上传 Skill</Button>
    </section>
    {storageError && <div role="alert" className="mt-6 rounded-xl border border-[#e7d7b5] bg-[#fff9ec] p-4 text-sm leading-6 text-[#8a6b28]">{storageError}</div>}
    <div className="skill-workspace mt-8">
      <aside className="min-w-0" aria-label="Skill 分类">
        <p className="mb-3 px-3 text-[11px] font-bold tracking-wider text-[#8a9587]">常用技能库</p>
        <div className="flex gap-1 sm:block sm:space-y-1">
          <button className={cn("skill-nav", filter === "all" && !tag && "skill-nav-active")} aria-pressed={filter === "all" && !tag} onClick={() => { setFilter("all"); setTag(""); }}><Library className="size-4" /><span className="flex-1 text-left">全部 Skill</span><span className="skill-count">{skills.length}</span></button>
          <button className={cn("skill-nav", filter === "favorites" && "skill-nav-active")} aria-pressed={filter === "favorites"} onClick={() => { setFilter("favorites"); setTag(""); }}><Star className="size-4" /><span className="flex-1 text-left">我的收藏</span><span className="skill-count">{favorites}</span></button>
        </div>
        <div className="mt-7 border-t border-[#dce1da] pt-5"><div className="mb-3 flex items-center gap-2 px-3 text-[11px] font-bold tracking-wider text-[#8a9587]"><Tag className="size-3" />标签</div>{tags.length ? <div className="flex flex-wrap gap-1 sm:block sm:space-y-1">{tags.map((item) => <button key={item} aria-pressed={tag === item} className={cn("skill-nav", tag === item && "skill-nav-active")} onClick={() => { setTag(tag === item ? "" : item); setFilter("all"); }}><span className="text-[#8a9587]">#</span><span className="min-w-0 flex-1 truncate text-left">{item}</span><span className="skill-count">{skills.filter((skill) => skill.tags.includes(item)).length}</span></button>)}</div> : <p className="px-3 text-xs leading-6 text-[#8a9587]">上传后可在编辑信息中添加标签。</p>}</div>
        <div className="mt-8 hidden border border-[#dce1da] bg-white/65 p-4 sm:block"><FileText className="size-5 text-[#7a8679]" /><p className="mt-3 text-xs font-bold">一个 Skill，一份可复用经验</p><p className="mt-2 text-xs leading-6 text-[#7a8679]">以 SKILL.md 为入口，脚本、参考资料和附件一起保存。</p><a href="/downloads/skill-template.md" download="SKILL.md" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#3156d8] hover:underline"><ArrowDownToLine className="size-3" />下载 Skill 模板</a></div>
        <p className="mt-5 px-3 text-[11px] text-[#8a9587]">{storageMode === "local" ? "保存在本机，刷新或重启后仍可使用" : "内容由可访问工具台的成员共享"}</p>
      </aside>
      <section className="min-w-0" aria-label="Skill 列表">
        <div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#798578]" /><Input aria-label="搜索 Skill" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、用途、标签或备注…" className="pl-10" /></div><div className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#798578]" /><select className="form-select pl-9! text-xs! sm:w-36" aria-label="Skill 排序" value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">最近更新</option><option value="name">名称 A–Z</option></select></div></div>
        <div className="my-5 flex items-center justify-between gap-2"><h2 className="text-sm font-bold">{tag ? `# ${tag}` : filter === "favorites" ? "我的收藏" : "全部 Skill"}<span className="ml-2 text-xs font-medium text-[#8a9587]">{visible.length} 个</span></h2>{(query || tag || filter !== "all") && <button className="rounded text-xs text-[#667366] hover:text-[#3156d8] focus-visible:outline-2 focus-visible:outline-[#3156d8]" onClick={reset}>清除筛选</button>}</div>
        {visible.length ? <div className="skill-list">
          <div className="skill-list-heading" aria-hidden="true"><span>Skill / 用途</span><span>标签</span><span>文件</span><span>最近更新</span><span className="text-right">管理</span></div>
          <ul aria-label="已保存的 Skill" className="divide-y divide-[#e4e8e1]">{visible.map((skill) => <li key={skill.id} className="skill-list-row">
            <div className="skill-list-summary flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-[#dce1da] bg-[#f4f6f2] text-[#3156d8]"><FileText className="size-4" /></span>
              <div className="min-w-0"><button className="rounded text-left focus-visible:outline-2 focus-visible:outline-[#3156d8]" onClick={() => setDialog({ type: "detail", skill })}><h3 className="break-words text-sm font-bold hover:text-[#3156d8]">{skill.name}</h3></button><p className="mt-1 line-clamp-2 break-words text-xs leading-6 text-[#667366]">{skill.description || "还没有用途说明，点击编辑补充。"}</p><p className="mt-1 truncate text-[10px] text-[#8a9587]" title={skill.sourceName}>{skill.sourceName}</p></div>
              <Button variant="ghost" size="icon" className={cn("size-7", skill.favorite && "text-[#a37d25] hover:text-[#a37d25]")} disabled={busyIds.has(skill.id)} aria-label={`${skill.favorite ? "取消收藏" : "收藏"} ${skill.name}`} aria-pressed={skill.favorite} onClick={() => act(skill, "favorite")}><Star className={cn("size-3.5", skill.favorite && "fill-current")} /></Button>
            </div>
            <div className="skill-list-tags flex flex-wrap gap-1">{skill.tags.length ? skill.tags.slice(0, 3).map((item) => <button key={item} className="skill-tag hover:border-[#b6c2e9]" onClick={() => { setTag(item); setFilter("all"); }}>{item}</button>) : <span className="text-xs text-[#a0a99d]">未添加标签</span>}{skill.tags.length > 3 && <span className="skill-tag">+{skill.tags.length - 3}</span>}</div>
            <div className="text-xs text-[#667366]"><p>{skill.files.length} 个文件</p><p className="mt-1 text-[10px] text-[#8a9587]">{formatSkillSize(skill.totalBytes)}</p></div>
            <time dateTime={skill.updatedAt} className="text-xs text-[#8a9587]">{new Date(skill.updatedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" })}</time>
            <div className="skill-list-actions flex items-center justify-end gap-0.5"><Button variant="ghost" size="sm" className="px-2 text-[#3156d8]" onClick={() => setDialog({ type: "detail", skill })}>查看 Skill<ArrowUpRight className="size-3" /></Button><Button variant="ghost" size="icon" className="size-8" disabled={busyIds.has(skill.id)} aria-label={`编辑 ${skill.name}`} title="编辑信息" onClick={() => setDialog({ type: "edit", skill })}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8" disabled={busyIds.has(skill.id)} aria-label={`下载 ${skill.name}`} title="下载 ZIP" onClick={() => act(skill, "download")}><Download className="size-3.5" /></Button><ConfirmDialog title={`删除「${skill.name}」？`} description="将删除此 Skill 的文件、标签和备注，此操作无法撤销。" onConfirm={() => act(skill, "delete")} trigger={<Button variant="ghost" size="icon" className="size-8 text-[#b84040]" disabled={busyIds.has(skill.id)} aria-label={`删除 ${skill.name}`} title="删除">{busyIds.has(skill.id) ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}</Button>} /></div>
          </li>)}</ul>
        </div> : <div className="skill-empty"><span className="grid size-16 place-items-center rounded-2xl border border-[#d7dfd3] bg-white text-[#3156d8]">{skills.length ? <Search className="size-7" /> : <Library className="size-7" />}</span><h3 className="mt-6 text-xl font-bold">{skills.length ? "没有找到匹配的 Skill" : "你的下一个好用技能，从这里开始"}</h3><p className="mt-3 max-w-sm text-sm leading-7 text-[#7a8679]">{skills.length ? "试试其他关键词，或清除筛选查看全部技能。" : "上传一个 SKILL.md 或完整技能包，把常用的工作方法整理成随手可取的技能库。"}</p>{skills.length ? <Button variant="secondary" className="mt-6" onClick={reset}>查看全部 Skill</Button> : <><Button variant="primary" className="mt-6" disabled={Boolean(storageError)} onClick={() => setDialog({ type: "upload" })}><Upload className="size-4" />上传第一个 Skill</Button><a href="/downloads/skill-template.md" download="SKILL.md" className="mt-4 text-xs text-[#7a8679] underline underline-offset-4 hover:text-[#3156d8]">还没有 Skill？下载模板开始</a></>}</div>}
      </section>
    </div>
    {dialog?.type === "upload" && <SkillUpload skill={dialog.skill} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.type === "detail" && <SkillDetailDialog key={dialog.skill.id} skill={dialog.skill} onClose={() => setDialog(null)} onEdit={() => setDialog({ type: "edit", skill: dialog.skill })} onReplace={() => setDialog({ type: "upload", skill: dialog.skill })} />}
    {dialog?.type === "edit" && <SkillEditor skill={dialog.skill} onClose={() => setDialog(null)} onSaved={saved} />}
  </main>;
}
