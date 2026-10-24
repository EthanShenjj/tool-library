import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformAccounts, type PlatformAccount } from "@/lib/db/schema";
import { decryptJson, encryptJson } from "@/lib/security";
import type { AccountInput, AccountSummary } from "@/lib/validation/account";

type AccountSecrets = { username: string; password: string; notes: string };

export function summarizeAccount(account: PlatformAccount): AccountSummary {
  const secrets = decryptJson<AccountSecrets>(account.encryptedPayload);
  return {
    id: account.id,
    platform: account.platform,
    websiteUrl: account.websiteUrl,
    username: secrets.username,
    notes: secrets.notes,
    hasPassword: Boolean(secrets.password),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export async function listAccounts() {
  const accounts = await getDb().select().from(platformAccounts).orderBy(desc(platformAccounts.updatedAt));
  return accounts.map(summarizeAccount);
}

export async function getAccount(id: string) {
  const [account] = await getDb().select().from(platformAccounts).where(eq(platformAccounts.id, id)).limit(1);
  return account ?? null;
}

export async function saveAccount(input: AccountInput, existing?: PlatformAccount) {
  const password = input.password ?? (existing ? decryptJson<AccountSecrets>(existing.encryptedPayload).password : "");
  const values = {
    platform: input.platform,
    websiteUrl: input.websiteUrl,
    encryptedPayload: encryptJson({ username: input.username, password, notes: input.notes }),
    updatedAt: new Date(),
  };
  const [account] = existing
    ? await getDb().update(platformAccounts).set(values).where(eq(platformAccounts.id, existing.id)).returning()
    : await getDb().insert(platformAccounts).values(values).returning();
  return account ? summarizeAccount(account) : null;
}

export function readAccountPassword(account: PlatformAccount) {
  return decryptJson<AccountSecrets>(account.encryptedPayload).password;
}

export async function deleteAccount(id: string) {
  const [deleted] = await getDb().delete(platformAccounts).where(eq(platformAccounts.id, id)).returning({ id: platformAccounts.id });
  return deleted ?? null;
}
