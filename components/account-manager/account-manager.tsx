"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronRight, Copy, Download, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { accountSchema, type AccountSummary } from "@/lib/validation/account";
import type { ApiEnvelope } from "@/lib/api";
import { platformCategories, recognizePlatform, type PlatformCategory } from "@/lib/account-platform";

async function accountRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json() as ApiEnvelope<T>;
  if (!result.success) throw new Error(result.error.message);
  if (!response.ok) throw new Error("账号操作失败，请重试。");
  return result.data;
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}已复制`);
  } catch { toast.error("复制失败，请检查浏览器剪贴板权限。"); }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}

export function AccountManager({ initialAccounts, storageError }: { initialAccounts: AccountSummary[]; storageError: string }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState<PlatformCategory | "">("");
  const [editor, setEditor] = useState<{ account?: AccountSummary } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const revision = useRef(0);
  const platforms = [...new Set(accounts.map((account) => account.platform))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const keyword = query.trim().toLowerCase();
  const visible = accounts.filter((account) => {
    const recognition = recognizePlatform(account.websiteUrl);
    return (!platform || account.platform === platform) && (!category || recognition.category === category) &&
      (!keyword || `${account.platform} ${recognition.name} ${recognition.categoryLabel} ${account.websiteUrl} ${account.username} ${account.notes}`.toLowerCase().includes(keyword));
  });

  useEffect(() => {
    if (storageError) return;
    let pending: AbortController | null = null;
    const refresh = async (event: Event) => {
      if (document.hidden && event.type !== "account-manager:changed") return;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const startedAtRevision = revision.current;
      try {
        const response = await fetch("/api/accounts", { cache: "no-store", signal: controller.signal });
        const result = await response.json() as ApiEnvelope<{ accounts: AccountSummary[] }>;
        if (response.ok && result.success && !controller.signal.aborted && startedAtRevision === revision.current) {
          setAccounts(result.data.accounts);
        }
      } catch {
        // Keep the current list and any open editor intact if a background refresh fails.
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("account-manager:changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("account-manager:changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [storageError]);

  function saved(account: AccountSummary) {
    revision.current += 1;
    setAccounts((current) => [account, ...current.filter((item) => item.id !== account.id)]);
    setQuery("");
    setPlatform("");
    setCategory("");
    setEditor(null);
    toast.success(editor?.account ? "账号已更新" : "账号已添加");
  }

  async function remove(account: AccountSummary) {
    revision.current += 1;
    setDeleting(account.id);
    try {
      await accountRequest(`/api/accounts/${account.id}`, "DELETE");
      revision.current += 1;
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      if (platform === account.platform && accounts.filter((item) => item.platform === platform).length === 1) setPlatform("");
      toast.success("账号已删除");
    } catch (error) { toast.error(message(error)); }
    finally { setDeleting(null); }
  }

  return (
    <main className="workspace-shell">
      <nav className="workspace-nav" aria-label="面包屑"><Link href="/">工具目录</Link><ChevronRight className="size-3.5" /><span aria-current="page">账号管理</span></nav>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <span className="mb-4 grid size-11 place-items-center rounded-[13px] bg-[#e7ebff] text-[#3156d8]"><KeyRound className="size-5" /></span>
          <h1 className="workspace-title">账号管理</h1>
          <p className="mt-3 text-sm leading-7 text-[#667366]">把各个平台的账号和网站地址，收在同一个地方。</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><a href="/downloads/account-manager-chrome-extension.zip" download><Download className="size-4" />下载 Chrome 插件</a></Button><Button variant="primary" disabled={Boolean(storageError)} onClick={() => setEditor({})}><Plus className="size-4" />添加账号</Button></div>
      </div>

      {storageError && <div role="alert" className="mb-5 border border-[#e6c66d] bg-[#fff5d8] p-4 text-sm leading-6 text-[#6e5318]">{storageError}</div>}

      <details className="surface mb-5 px-5 py-4 text-sm text-[#667366]">
        <summary className="cursor-pointer font-semibold text-[#344137]">用 Chrome 插件快速保存当前网页</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-6">
          <li>下载并解压插件 ZIP，保留解压后的文件夹。</li>
          <li>在 Chrome 地址栏打开 <code>chrome://extensions</code>，开启右上角“开发者模式”。</li>
          <li>点击“加载已解压的扩展程序”，选择包含 <code>manifest.json</code> 的文件夹，然后把插件固定到工具栏。</li>
          <li>在同一 Chrome 中登录本工具台；浏览网页时点击插件，网址会自动带入，账号和密码可以留空。</li>
        </ol>
        <p className="mt-3 text-xs leading-6">插件复用工具台登录状态，仅保存你主动填写的信息。遇到重复账号时，可选择更新或另存；更新时留空密码和备注会保留原内容。</p>
      </details>

      <section className="surface" aria-label="平台账号">
        <div className="flex flex-col justify-between gap-4 border-b border-[#dce1da] p-5 xl:flex-row xl:items-center">
          <div className="flex items-baseline gap-3"><h2 className="text-base font-bold">全部账号</h2><span className="text-xs text-[#758174]">{accounts.length} 个账号 / {platforms.length} 个平台</span></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="relative sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#798578]" /><Input aria-label="搜索账号" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索平台、账号、网址、分类或备注" className="pl-9" /></div>
            <select aria-label="按平台筛选" className="form-select sm:max-w-44" value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="">全部平台</option>{platform && !platforms.includes(platform) && <option value={platform}>{platform}（暂无账号）</option>}{platforms.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="按用途分类筛选" className="form-select sm:max-w-36" value={category} onChange={(event) => setCategory(event.target.value as PlatformCategory | "")}><option value="">全部分类</option>{Object.entries(platformCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>

        {visible.length ? (
          <>
            <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_104px] gap-5 border-b border-[#e4e8e1] bg-[#f7f9f6] px-6 py-3 text-xs font-semibold text-[#758174] lg:grid"><span>平台 / 网站</span><span>账号</span><span>密码</span><span>备注</span><span className="text-right">管理</span></div>
            <ul className="divide-y divide-[#e4e8e1]">{visible.map((account) => <AccountRow key={`${account.id}-${account.updatedAt}`} account={account} busy={deleting === account.id} onEdit={() => setEditor({ account })} onDelete={() => remove(account)} />)}</ul>
          </>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            {accounts.length ? <Search className="size-8 text-[#8a9587]" /> : <KeyRound className="size-8 text-[#8a9587]" />}
            <h3 className="mt-2 font-bold">{storageError ? "等待连接账号存储" : accounts.length ? "没有匹配的账号" : "从第一个平台账号开始"}</h3>
            <p className="max-w-sm text-sm leading-6 text-[#758174]">{storageError ? "完成上方配置后，刷新页面即可添加账号。" : accounts.length ? "试试其他关键词，或切换平台、用途分类筛选。" : "保存平台名称、网站地址和登录信息，下次使用时直接找到。"}</p>
            {!storageError && (accounts.length ? <Button variant="secondary" onClick={() => { setQuery(""); setPlatform(""); setCategory(""); }}>清除筛选</Button> : <Button className="mt-2" variant="secondary" onClick={() => setEditor({})}><Plus className="size-4" />添加第一个账号</Button>)}
          </div>
        )}
        <div className="flex items-start gap-2 border-t border-[#e4e8e1] px-5 py-4 text-xs leading-5 text-[#758174]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#287b56]" /><p>账号、密码与备注加密存储。密码按需读取，显示 30 秒后自动隐藏。工作区成员共享访问。</p></div>
      </section>
      {editor && <AccountEditor account={editor.account} onClose={() => setEditor(null)} onSaved={saved} />}
    </main>
  );
}

function AccountRow({ account, busy, onEdit, onDelete }: { account: AccountSummary; busy: boolean; onEdit: () => void; onDelete: () => Promise<void> }) {
  const recognition = recognizePlatform(account.websiteUrl);
  const [password, setPassword] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (password === null) return;
    const timer = window.setTimeout(() => setPassword(null), 30_000);
    const hide = () => { if (document.hidden) setPassword(null); };
    document.addEventListener("visibilitychange", hide);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", hide); };
  }, [password]);

  async function readPassword(copy: boolean) {
    setReading(true);
    try {
      const result = await accountRequest<{ password: string }>(`/api/accounts/${account.id}/password`, "POST");
      if (copy) await copyText(result.password, "密码");
      else setPassword(result.password);
    } catch (error) { toast.error(message(error)); }
    finally { setReading(false); }
  }

  return (
    <li className="grid min-w-0 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_104px] lg:items-center lg:px-6">
      <div className="min-w-0"><h3 className="break-words font-bold">{account.platform}</h3><p className="mt-1 text-[11px] text-[#287b56]">{recognition.recognized && recognition.name !== account.platform ? `${recognition.name} · ` : ""}{recognition.categoryLabel}</p>{account.websiteUrl ? <a href={account.websiteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded text-xs text-[#3156d8] hover:underline focus-visible:outline-2 focus-visible:outline-[#3156d8]" title={account.websiteUrl}><span className="truncate">{new URL(account.websiteUrl).host}</span><ExternalLink className="size-3 shrink-0" /><span className="sr-only">打开网站</span></a> : <p className="mt-1 text-xs text-[#8a9587]">未添加网站</p>}</div>
      <div className="min-w-0"><p className="mb-1 text-xs text-[#758174] lg:hidden">账号</p>{account.username ? <div className="flex items-center gap-1"><span className="min-w-0 break-all text-sm">{account.username}</span><Button variant="ghost" size="icon" className="size-8" aria-label={`复制 ${account.platform} 账号`} onClick={() => copyText(account.username, "账号")}><Copy className="size-3.5" /></Button></div> : <span className="text-xs text-[#8a9587]">未填写账号</span>}</div>
      <div className="min-w-0"><p className="mb-1 text-xs text-[#758174] lg:hidden">密码</p>{account.hasPassword ? <div className="flex items-center gap-1"><span className="min-w-0 break-all font-mono text-sm">{password ?? "••••••••"}</span><Button variant="ghost" size="icon" className="size-8" disabled={reading} aria-label={password === null ? `显示 ${account.platform} 密码` : `隐藏 ${account.platform} 密码`} onClick={() => password === null ? readPassword(false) : setPassword(null)}>{reading ? <Loader2 className="size-3.5 animate-spin" /> : password === null ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}</Button><Button variant="ghost" size="icon" className="size-8" disabled={reading} aria-label={`复制 ${account.platform} 密码`} onClick={() => readPassword(true)}><Copy className="size-3.5" /></Button></div> : <span className="text-xs text-[#8a9587]">未保存密码</span>}</div>
      <div className="min-w-0"><p className="mb-1 text-xs text-[#758174] lg:hidden">备注</p><p className="line-clamp-3 whitespace-pre-wrap break-words text-xs leading-6 text-[#667366]" title={account.notes}>{account.notes || "—"}</p></div>
      <div className="flex items-center justify-end gap-1 border-t border-[#e4e8e1] pt-3 lg:border-0 lg:pt-0"><Button variant="ghost" size="icon" disabled={busy} aria-label={`编辑 ${account.platform} 账号`} onClick={onEdit}><Pencil className="size-4" /></Button><ConfirmDialog title={`删除 ${account.platform} 账号？`} description={`将删除账号 ${account.username} 的全部信息，此操作无法撤销。`} onConfirm={onDelete} trigger={<Button variant="ghost" size="icon" disabled={busy} className="text-[#b84040]" aria-label={`删除 ${account.platform} 账号`}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</Button>} /></div>
    </li>
  );
}

function AccountEditor({ account, onClose, onSaved }: { account?: AccountSummary; onClose: () => void; onSaved: (account: AccountSummary) => void }) {
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);
  const [error, setError] = useState("");
  const [platformName, setPlatformName] = useState(account?.platform ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(account?.websiteUrl ?? "");
  const autoPlatform = useRef("");
  const recognition = recognizePlatform(websiteUrl);

  function changeWebsite(value: string) {
    setWebsiteUrl(value);
    const suggested = recognizePlatform(value).name;
    if (suggested && (!platformName || platformName === autoPlatform.current)) {
      setPlatformName(suggested);
      autoPlatform.current = suggested;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawPassword = String(form.get("password") ?? "");
    const parsed = accountSchema.safeParse({
      platform: form.get("platform"), websiteUrl: form.get("websiteUrl"), username: form.get("username"), notes: form.get("notes"),
      password: clearPassword ? "" : account && !rawPassword ? undefined : rawPassword,
    });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setSaving(true);
    setError("");
    try {
      const saved = await accountRequest<AccountSummary>(account ? `/api/accounts/${account.id}` : "/api/accounts", account ? "PATCH" : "POST", parsed.data);
      onSaved(saved);
    } catch (error) { setError(message(error)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#18212f]/40 backdrop-blur-[2px]" />
        <Dialog.Content aria-busy={saving} className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#dce1da] bg-white p-6 shadow-2xl">
          <Dialog.Title className="pr-8 text-xl font-bold">{account ? "编辑账号" : "添加账号"}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[#667366]">保存平台信息，随时查找和访问。</Dialog.Description>
          <Dialog.Close asChild><Button variant="ghost" size="icon" disabled={saving} className="absolute right-4 top-4" aria-label="关闭"><X className="size-4" /></Button></Dialog.Close>
          <form onSubmit={submit} className="mt-6">
            <fieldset disabled={saving} className="space-y-4">
              <div><label className="form-label" htmlFor="account-platform">平台名称 <span className="text-[#b84040]">*</span></label><Input id="account-platform" name="platform" required maxLength={100} value={platformName} onChange={(event) => setPlatformName(event.target.value)} placeholder="例如：小红书、GitHub、飞书" /></div>
              <div><label className="form-label" htmlFor="account-url">网站 URL</label><Input id="account-url" name="websiteUrl" type="url" maxLength={2000} value={websiteUrl} onChange={(event) => changeWebsite(event.target.value)} placeholder="https://www.example.com" /><p className="form-hint">{recognition.recognized ? `识别为 ${recognition.name} · ${recognition.categoryLabel}` : recognition.hostname ? "暂未识别平台，将显示为未分类。" : "填写完整网站或登录页面地址，可自动识别平台和用途分类。"}</p>{recognition.recognized && platformName !== recognition.name && <Button type="button" variant="ghost" className="mt-1 h-7 px-0 text-xs text-[#3156d8]" onClick={() => { setPlatformName(recognition.name); autoPlatform.current = recognition.name; }}>使用识别名称</Button>}</div>
              <div><label className="form-label" htmlFor="account-username">账号</label><Input id="account-username" name="username" autoComplete="off" maxLength={320} defaultValue={account?.username} placeholder="选填：用户名、邮箱或手机号" /></div>
              <div><label className="form-label" htmlFor="account-password">{account ? "新密码" : "密码"}</label><div className="relative"><Input id="account-password" name="password" type={showPassword ? "text" : "password"} disabled={clearPassword} autoComplete="new-password" maxLength={4096} className="pr-12" placeholder={account?.hasPassword ? "留空保留原密码" : "选填"} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-0.5" disabled={clearPassword} aria-label={showPassword ? "隐藏输入的密码" : "显示输入的密码"} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>{account?.hasPassword && <label className="mt-2 flex items-center gap-2 text-xs text-[#667366]"><input type="checkbox" checked={clearPassword} onChange={(event) => setClearPassword(event.target.checked)} />移除已保存的密码</label>}</div>
              <div><label className="form-label" htmlFor="account-notes">备注</label><textarea id="account-notes" name="notes" className="form-textarea min-h-24 font-sans! text-sm!" maxLength={5000} defaultValue={account?.notes} placeholder="例如：账号用途、所属项目或负责人" /></div>
            </fieldset>
            {error && <p role="alert" className="mt-4 text-sm text-[#b84040]">{error}</p>}
            <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>取消</Button><Button type="submit" variant="primary" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "保存中…" : "保存账号"}</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
