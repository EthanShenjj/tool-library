import "server-only";

import { desc, eq, ne } from "drizzle-orm";
import { getDb } from "./index";
import {
  googleCredentials,
  sheetConnectors,
  type CredentialMode,
  type NewSheetConnector,
} from "./schema";

export async function getCredential(mode: CredentialMode) {
  const [credential] = await getDb()
    .select()
    .from(googleCredentials)
    .where(eq(googleCredentials.mode, mode))
    .limit(1);
  return credential ?? null;
}

export async function listCredentialStatuses() {
  return getDb().select({
    mode: googleCredentials.mode,
    email: googleCredentials.email,
    permissionsReady: googleCredentials.permissionsReady,
    updatedAt: googleCredentials.updatedAt,
  }).from(googleCredentials);
}

export async function upsertCredential(input: {
  mode: CredentialMode;
  encryptedPayload: string;
  email?: string | null;
  permissionsReady: boolean;
}) {
  const [credential] = await getDb()
    .insert(googleCredentials)
    .values({ ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: googleCredentials.mode,
      set: {
        encryptedPayload: input.encryptedPayload,
        email: input.email ?? null,
        permissionsReady: input.permissionsReady,
        updatedAt: new Date(),
      },
    })
    .returning({
      mode: googleCredentials.mode,
      email: googleCredentials.email,
      permissionsReady: googleCredentials.permissionsReady,
      updatedAt: googleCredentials.updatedAt,
    });

  // The workspace has one shared Google identity. Only remove the previous
  // method after the new credential has been saved successfully, so a failed
  // replacement never disconnects a working integration.
  await getDb().delete(googleCredentials).where(ne(googleCredentials.mode, input.mode));
  return credential;
}

export async function removeCredential(mode: CredentialMode) {
  await getDb().delete(googleCredentials).where(eq(googleCredentials.mode, mode));
}

export async function listConnectors() {
  return getDb().select().from(sheetConnectors).orderBy(desc(sheetConnectors.updatedAt));
}

export async function getConnector(id: string) {
  const [connector] = await getDb()
    .select()
    .from(sheetConnectors)
    .where(eq(sheetConnectors.id, id))
    .limit(1);
  return connector ?? null;
}

export async function createConnector(input: NewSheetConnector) {
  const [connector] = await getDb().insert(sheetConnectors).values(input).returning();
  return connector;
}

export async function updateConnector(id: string, input: Partial<NewSheetConnector>) {
  const [connector] = await getDb()
    .update(sheetConnectors)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(sheetConnectors.id, id))
    .returning();
  return connector ?? null;
}

export async function deleteConnector(id: string) {
  const [connector] = await getDb()
    .delete(sheetConnectors)
    .where(eq(sheetConnectors.id, id))
    .returning({ id: sheetConnectors.id });
  return connector ?? null;
}
