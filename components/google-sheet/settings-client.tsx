"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, KeyRound, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type CredentialStatus = { mode: "service_account" | "oauth"; email: string | null; permissionsReady: boolean; updatedAt: string | Date };
type CredentialMode = CredentialStatus["mode"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error?.message || "操作失败");
  return payload.data;
}

export function SettingsClient({ initialCredentials, databaseConfigured, oauthResult }: { initialCredentials: CredentialStatus[]; databaseConfigured: boolean; oauthResult?: string }) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [serviceJson, setServiceJson] = useState("");
  const [selectedMode, setSelectedMode] = useState<CredentialMode>(initialCredentials[0]?.mode || "service_account");
  const [pending, startTransition] = useTransition();
  const serviceAccount = credentials.find((item) => item.mode === "service_account");
  const oauth = credentials.find((item) => item.mode === "oauth");

  async function refresh() {
    const result = await api<{ credentials: CredentialStatus[] }>("/api/google/credentials");
    setCredentials(result.credentials);
  }

  function saveServiceAccount() {
    if (!serviceJson.trim()) {
      toast.error("请粘贴 Service Account JSON");
      return;
    }
    startTransition(async () => {
      try {
        await api("/api/google/credentials", { method: "POST", body: JSON.stringify({ json: serviceJson }) });
        setServiceJson("");
        await refresh();
        toast.success(oauth ? "已切换为 Service Account，原 Google OAuth 已移除" : "Service Account 已验证并加密保存");
      } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); }
    });
  }

  function removeServiceAccount() {
    startTransition(async () => {
      try { await api("/api/google/credentials", { method: "DELETE" }); await refresh(); toast.success("Service Account 已移除"); }
      catch (error) { toast.error(error instanceof Error ? error.message : "移除失败"); }
    });
  }

  function connectOAuth() {
    startTransition(async () => {
      try { const result = await api<{ url: string }>("/api/google/oauth/start"); window.location.assign(result.url); }
      catch (error) { toast.error(error instanceof Error ? error.message : "无法启动授权"); }
    });
  }

  function selectMode(mode: CredentialMode) {
    setSelectedMode(mode);
    setServiceJson("");
  }

  function serviceSaveButton(asConfirmationTrigger = false) {
    return <Button variant="primary" onClick={asConfirmationTrigger ? undefined : saveServiceAccount} disabled={pending || !databaseConfigured || !serviceJson.trim()}>
      {pending && <RefreshCw className="size-4 animate-spin" />}
      {oauth ? "切换并保存" : "验证并保存"}
    </Button>;
  }

  function oauthConnectButton(asConfirmationTrigger = false) {
    return <Button variant={oauth ? "secondary" : "primary"} onClick={asConfirmationTrigger ? undefined : connectOAuth} disabled={pending || !databaseConfigured}>
      {serviceAccount ? "切换并连接" : oauth ? "重新授权" : "连接 Google"}
    </Button>;
  }

  function disconnectOAuth() {
    startTransition(async () => {
      try { await api("/api/google/oauth/disconnect", { method: "POST" }); await refresh(); toast.success("Google OAuth 已解除"); }
      catch (error) { toast.error(error instanceof Error ? error.message : "解除失败"); }
    });
  }

  return (
    <div className="space-y-5">
      {oauthResult && <div className={`border p-4 text-sm ${oauthResult === "success" ? "border-[#addcc2] bg-[#e9f8f0] text-[#205d40]" : "border-[#e6c66d] bg-[#fff5d8] text-[#6e5318]"}`}>{oauthResult === "success" ? "Google OAuth 授权完成。团队现在可以使用这个共享连接。" : oauthResult === "missing_scopes" ? "授权已保存，但缺少 Sheets 或 Drive 只读权限，请重新授权并勾选全部权限。" : "Google OAuth 授权未完成，请重新尝试。"}</div>}
      {!databaseConfigured && <div className="flex gap-3 border border-[#e6c66d] bg-[#fff5d8] p-4 text-sm text-[#6e5318]"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><strong>数据库未配置</strong><p className="mt-1 leading-6">先设置 DATABASE_URL 和 CREDENTIALS_ENCRYPTION_KEY，才能安全保存共享凭据。</p></div></div>}

      <section className="surface p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="font-bold">选择认证方式</h2><p className="mt-1 text-sm text-[#6d796c]">一个工作区只能启用一种共享认证方式。</p></div>
          {(serviceAccount || oauth) && <Badge variant="green">当前已启用 1 种</Badge>}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Google 认证方式">
          <button type="button" role="radio" aria-checked={selectedMode === "service_account"} onClick={() => selectMode("service_account")} className={`flex min-h-28 items-start gap-4 rounded-xl border p-4 text-left transition ${selectedMode === "service_account" ? "border-[#3156d8] bg-[#f2f5ff] ring-1 ring-[#3156d8]" : "border-[#dce1da] bg-white hover:border-[#aeb8aa]"}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white shadow-sm"><KeyRound className="size-4 text-[#3156d8]" /></span>
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-bold">Service Account{serviceAccount && <Badge variant="green">当前使用</Badge>}</span><span className="mt-1.5 block text-sm leading-5 text-[#6d796c]">适合团队共享和后续自动化，需要将表格分享给服务账号。</span></span>
            <span className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border ${selectedMode === "service_account" ? "border-[#3156d8] bg-[#3156d8] text-white" : "border-[#bcc5ba]"}`}>{selectedMode === "service_account" && <Check className="size-3" />}</span>
          </button>
          <button type="button" role="radio" aria-checked={selectedMode === "oauth"} onClick={() => selectMode("oauth")} className={`flex min-h-28 items-start gap-4 rounded-xl border p-4 text-left transition ${selectedMode === "oauth" ? "border-[#3156d8] bg-[#f2f5ff] ring-1 ring-[#3156d8]" : "border-[#dce1da] bg-white hover:border-[#aeb8aa]"}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-base font-extrabold text-[#4285f4] shadow-sm">G</span>
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-bold">Google OAuth{oauth && <Badge variant={oauth.permissionsReady ? "green" : "amber"}>{oauth.permissionsReady ? "当前使用" : "权限不完整"}</Badge>}</span><span className="mt-1.5 block text-sm leading-5 text-[#6d796c]">由管理员授权一次，共享读取该 Google 账号可访问的表格。</span></span>
            <span className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border ${selectedMode === "oauth" ? "border-[#3156d8] bg-[#3156d8] text-white" : "border-[#bcc5ba]"}`}>{selectedMode === "oauth" && <Check className="size-3" />}</span>
          </button>
        </div>
      </section>

      {selectedMode === "service_account" ? (
        <section className="surface">
          <div className="flex items-start justify-between gap-4 border-b border-[#e3e7e1] p-5"><div><div className="flex items-center gap-2"><KeyRound className="size-4 text-[#3156d8]" /><h2 className="font-bold">配置 Service Account</h2>{serviceAccount && <Badge variant="green">已连接</Badge>}</div><p className="mt-2 text-sm leading-6 text-[#6d796c]">粘贴服务账号 JSON，验证通过后才会保存。</p></div>{serviceAccount && <CheckCircle2 className="size-5 text-[#287b56]" />}</div>
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px]">
            <div><label className="form-label" htmlFor="service-account-json">Service Account JSON</label><textarea id="service-account-json" className="form-textarea min-h-52" value={serviceJson} onChange={(event) => setServiceJson(event.target.value)} placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'} /><p className="form-hint">私钥只会发送到服务端，经验证后使用 AES-256-GCM 加密存入 Postgres。</p><div className="mt-4 flex flex-wrap gap-2">{oauth ? <ConfirmDialog title="切换为 Service Account？" description="验证成功后将移除当前 Google OAuth。使用 OAuth 的连接器会保留，但需要改用新的认证方式后重新测试。" onConfirm={saveServiceAccount} confirmLabel="确认切换" trigger={serviceSaveButton(true)} /> : serviceSaveButton()}{serviceAccount && <ConfirmDialog title="移除 Service Account？" description="使用该认证方式的连接器会保留，但将显示为“需要重新连接”。" onConfirm={removeServiceAccount} confirmLabel="确认移除" trigger={<Button variant="secondary" disabled={pending}>移除凭据</Button>} />}</div></div>
            <aside className="rounded-xl bg-[#f1f4ef] p-5 text-sm"><p className="font-bold">当前状态</p><dl className="mt-4 space-y-4"><div><dt className="text-xs text-[#7a8679]">服务账号</dt><dd className="mt-1 break-all font-semibold">{serviceAccount?.email || "未配置"}</dd></div><div><dt className="text-xs text-[#7a8679]">访问范围</dt><dd className="mt-1 font-semibold">Sheets / Drive 只读</dd></div></dl></aside>
          </div>
        </section>
      ) : (
        <section className="surface">
          <div className="flex items-start justify-between gap-4 border-b border-[#e3e7e1] p-5"><div><div className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded bg-white text-sm font-extrabold text-[#4285f4]">G</span><h2 className="font-bold">配置 Google OAuth</h2>{oauth && <Badge variant={oauth.permissionsReady ? "green" : "amber"}>{oauth.permissionsReady ? "已连接" : "权限不完整"}</Badge>}</div><p className="mt-2 text-sm leading-6 text-[#6d796c]">由管理员授权一次，团队成员共享读取该账号可访问的 Spreadsheet。</p></div></div>
          <div className="flex flex-col justify-between gap-5 p-5 md:flex-row md:items-center"><div><p className="text-sm font-semibold">{oauth?.email || "尚未连接 Google 账号"}</p><p className="mt-1 text-xs text-[#7b877a]">授权令牌加密存储；应用不会申请表格写入权限。</p>{serviceAccount && <p className="mt-3 text-xs font-semibold text-[#a35728]">连接成功后，将自动移除当前 Service Account。</p>}</div><div className="flex gap-2">{serviceAccount ? <ConfirmDialog title="切换为 Google OAuth？" description="Google 授权成功后将移除当前 Service Account。使用 Service Account 的连接器会保留，但需要改用新认证后重新测试。" onConfirm={connectOAuth} confirmLabel="继续授权" trigger={oauthConnectButton(true)} /> : oauthConnectButton()}{oauth && <ConfirmDialog title="解除 Google OAuth？" description="远端撤销失败时仍会删除本地令牌。相关连接器会保留但无法预览数据。" onConfirm={disconnectOAuth} confirmLabel="解除授权" trigger={<Button variant="ghost" disabled={pending}><LogOut className="size-4" />解除</Button>} />}</div></div>
        </section>
      )}
    </div>
  );
}
