import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SettingsClient } from "@/components/google-sheet/settings-client";
import { ToolHeading } from "@/components/google-sheet/tool-heading";
import { Button } from "@/components/ui/button";
import { isDatabaseConfigured } from "@/lib/db";
import { listCredentialStatuses } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function GoogleSettingsPage({ searchParams }: { searchParams: Promise<{ oauth?: string }> }) {
  const databaseConfigured = isDatabaseConfigured();
  let credentials: Awaited<ReturnType<typeof listCredentialStatuses>> = [];
  if (databaseConfigured) {
    try { credentials = await listCredentialStatuses(); } catch { /* UI reports unavailable state. */ }
  }
  const { oauth } = await searchParams;
  return (
    <main className="workspace-shell max-w-[1120px]">
      <ToolHeading title="共享连接设置" description="为工作区选择一种 Google 认证方式。凭据只保存在服务端，不会发送回浏览器。">
        <Button asChild variant="secondary"><Link href="/tools/google-sheet"><ArrowLeft className="size-4" />返回连接器</Link></Button>
      </ToolHeading>
      <SettingsClient initialCredentials={credentials} databaseConfigured={databaseConfigured} oauthResult={oauth} />
    </main>
  );
}
