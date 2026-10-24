"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Copy, Edit3, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import type { SheetConnector } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

async function apiAction(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error?.message || "操作失败");
  return payload.data;
}

export function ConnectorList({ connectors, availableModes }: { connectors: SheetConnector[]; availableModes: string[] }) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return connectors.filter((item) => !keyword || `${item.name} ${item.sheet} ${item.spreadsheetId}`.toLowerCase().includes(keyword));
  }, [connectors, query]);

  function duplicate(id: string) {
    startTransition(async () => {
      try {
        await apiAction("/api/google-sheet/connectors", { method: "POST", body: JSON.stringify({ duplicateFrom: id }) });
        toast.success("连接器已复制");
        router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "复制失败"); }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await apiAction(`/api/google-sheet/connectors/${id}`, { method: "DELETE" });
        toast.success("连接器已删除");
        router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败"); }
    });
  }

  if (!connectors.length) {
    return (
      <div className="surface grid min-h-[330px] place-items-center p-8 text-center">
        <div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#edf0eb] text-[#6c786b]"><MoreHorizontal className="size-6" /></div><h2 className="mt-5 text-lg font-bold">还没有连接器</h2><p className="mt-2 text-sm text-[#718070]">创建第一个配置，验证表格结构并保存字段映射。</p><Button asChild variant="primary" className="mt-6"><Link href="/tools/google-sheet/connectors/new">新建连接器</Link></Button></div>
      </div>
    );
  }

  return (
    <div className="surface">
      <div className="flex flex-col justify-between gap-3 border-b border-[#e2e7df] p-4 sm:flex-row sm:items-center">
        <div><h2 className="font-bold">已保存的连接器</h2><p className="mt-1 text-xs text-[#748073]">这里只保存规则，不会自动执行同步。</p></div>
        <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7c887b]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索连接器" className="h-9 pl-9" /></div>
      </div>
      <div className="divide-y divide-[#e8ebe6]">
        {filtered.map((connector) => {
          const connected = availableModes.includes(connector.authMode);
          return (
            <article key={connector.id} className="grid gap-4 p-5 transition-colors hover:bg-[#f8faf7] lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,.7fr)_minmax(170px,.7fr)_auto] lg:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#18212f]">{connector.name}</h3><Badge variant={connected ? (connector.testStatus === "passed" ? "green" : "neutral") : "red"}>{!connected ? "需要重新连接" : connector.testStatus === "passed" ? "已验证" : connector.testStatus === "failed" ? "验证失败" : "未验证"}</Badge></div><p className="mt-1.5 truncate text-xs text-[#778376]">{connector.spreadsheetId} / {connector.sheet}</p></div>
              <div><p className="text-xs text-[#7a8679]">认证方式</p><p className="mt-1 text-sm font-semibold">{connector.authMode === "oauth" ? "Google OAuth" : "Service Account"}</p></div>
              <div><p className="text-xs text-[#7a8679]">最后修改</p><p className="mt-1 text-sm font-semibold">{formatDate(connector.updatedAt)}</p></div>
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="icon" aria-label="编辑连接器"><Link href={`/tools/google-sheet/connectors/${connector.id}`}><Edit3 className="size-4" /></Link></Button>
                <Button variant="ghost" size="icon" disabled={pending} onClick={() => duplicate(connector.id)} aria-label="复制连接器"><Copy className="size-4" /></Button>
                <ConfirmDialog title="删除连接器？" description={`“${connector.name}”的配置和字段映射将被永久删除。Google 表格本身不会受到影响。`} onConfirm={() => remove(connector.id)} trigger={<Button variant="ghost" size="icon" disabled={pending} aria-label="删除连接器"><Trash2 className="size-4" /></Button>} />
              </div>
            </article>
          );
        })}
        {!filtered.length && <div className="p-12 text-center text-sm text-[#748073]">没有匹配的连接器。</div>}
      </div>
    </div>
  );
}
