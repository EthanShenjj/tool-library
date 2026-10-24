import { notFound } from "next/navigation";
import { ConnectorForm } from "@/components/google-sheet/connector-form";
import { ToolHeading } from "@/components/google-sheet/tool-heading";
import { getConnector, listCredentialStatuses } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function EditConnectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [connector, credentials] = await Promise.all([getConnector(id), listCredentialStatuses()]);
  if (!connector) notFound();
  const initial = {
    name: connector.name,
    authMode: connector.authMode,
    spreadsheetId: connector.spreadsheetId,
    sheetUrl: connector.sheetUrl,
    sheet: connector.sheet,
    range: connector.range,
    headerRow: connector.headerRow,
    primaryKey: connector.primaryKey,
    importMode: connector.importMode as "append" | "upsert" | "replace",
    frequency: connector.frequency as "hourly" | "daily" | "weekly",
    scheduleTime: connector.scheduleTime,
    timezone: connector.timezone as "Asia/Shanghai" | "Asia/Tokyo" | "Asia/Seoul" | "UTC",
    fieldMapping: connector.fieldMapping,
    testPassed: connector.testStatus === "passed",
  };
  return <main className="workspace-shell"><ToolHeading title={`编辑：${connector.name}`} description="修改数据范围会让当前验证状态失效，需要重新测试后再保存。" /><ConnectorForm initial={initial} connectorId={id} availableModes={credentials.filter((item) => item.permissionsReady).map((item) => item.mode)} /></main>;
}
