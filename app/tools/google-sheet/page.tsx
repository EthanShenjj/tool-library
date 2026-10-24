import Link from "next/link";
import { Database, Plus, Settings2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectorList } from "@/components/google-sheet/connector-list";
import { ToolHeading } from "@/components/google-sheet/tool-heading";
import { isDatabaseConfigured } from "@/lib/db";
import { listConnectors, listCredentialStatuses } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function GoogleSheetPage() {
  let connectors: Awaited<ReturnType<typeof listConnectors>> = [];
  let credentials: Awaited<ReturnType<typeof listCredentialStatuses>> = [];
  let databaseError = !isDatabaseConfigured();
  if (!databaseError) {
    try { [connectors, credentials] = await Promise.all([listConnectors(), listCredentialStatuses()]); }
    catch { databaseError = true; }
  }
  const availableModes = credentials.filter((item) => item.permissionsReady).map((item) => item.mode);

  return (
    <main className="workspace-shell">
      <ToolHeading title="Google Sheet 连接器" description="验证只读访问、检查数据结构，并把字段映射和未来同步规则保存在团队工作区。">
        <Button asChild variant="secondary"><Link href="/tools/google-sheet/settings"><Settings2 className="size-4" />连接设置</Link></Button>
        <Button asChild variant="primary"><Link href="/tools/google-sheet/connectors/new"><Plus className="size-4" />新建连接器</Link></Button>
      </ToolHeading>

      {databaseError && <div className="mb-5 border border-[#e6c66d] bg-[#fff5d8] p-4 text-sm leading-6 text-[#6e5318]"><strong>数据库尚未就绪。</strong> 请设置 `DATABASE_URL` 并执行数据库迁移，随后即可保存团队连接与配置。</div>}

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="surface flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#e7ebff] text-[#3156d8]"><Database className="size-5" /></span><div><p className="text-xs text-[#758174]">连接器</p><p className="mt-1 text-xl font-bold">{connectors.length}</p></div></div>
        <div className="surface flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#dff5e9] text-[#17623d]"><ShieldCheck className="size-5" /></span><div><p className="text-xs text-[#758174]">可用认证</p><p className="mt-1 text-xl font-bold">{availableModes.length}</p></div></div>
        <div className="surface flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#fff0c9] text-[#7a5710]"><Settings2 className="size-5" /></span><div><p className="text-xs text-[#758174]">执行状态</p><p className="mt-1 text-sm font-bold">仅保存配置</p></div></div>
      </section>

      <ConnectorList connectors={connectors} availableModes={availableModes} />
    </main>
  );
}
