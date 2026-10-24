import type { Metadata } from "next";
import { AccountManager } from "@/components/account-manager/account-manager";
import { listAccounts } from "@/lib/accounts";
import { isDatabaseConfigured } from "@/lib/db";
import type { AccountSummary } from "@/lib/validation/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "账号管理" };

export default async function AccountManagerPage() {
  let accounts: AccountSummary[] = [];
  let storageError = "";
  if (!isDatabaseConfigured() || !/^[a-fA-F0-9]{64}$/.test(process.env.CREDENTIALS_ENCRYPTION_KEY ?? "")) {
    storageError = "账号存储尚未就绪。请配置 DATABASE_URL 和 64 位十六进制的 CREDENTIALS_ENCRYPTION_KEY，并执行 npm run db:migrate。";
  } else {
    try { accounts = await listAccounts(); }
    catch { storageError = "账号读取失败。请检查数据库连接、数据库迁移及加密密钥，然后刷新页面重试。"; }
  }
  return <AccountManager initialAccounts={accounts} storageError={storageError} />;
}
