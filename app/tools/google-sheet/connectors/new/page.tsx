import { ConnectorForm } from "@/components/google-sheet/connector-form";
import { ToolHeading } from "@/components/google-sheet/tool-heading";
import { isDatabaseConfigured } from "@/lib/db";
import { listCredentialStatuses } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function NewConnectorPage() {
  let availableModes: string[] = [];
  if (isDatabaseConfigured()) {
    try { availableModes = (await listCredentialStatuses()).filter((item) => item.permissionsReady).map((item) => item.mode); } catch { /* Form shows setup guidance. */ }
  }
  return <main className="workspace-shell"><ToolHeading title="新建 Sheet 连接器" description="按顺序验证团队连接、选择数据范围，并保存字段映射。" /><ConnectorForm availableModes={availableModes} /></main>;
}
