import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { savedSkills } from "@/lib/db/schema";
import type { SkillDetail, SkillMetadata, SkillSummary } from "./schema";
import type { prepareSkillPackage } from "./package";

export function usesLocalSkillStorage() { return !isDatabaseConfigured() && !process.env.VERCEL; }

async function localStore() {
  return (await import("./local-storage")).getLocalSkillStore();
}

// Lists and metadata updates never load or return the archived package.
const summaryColumns = {
  id: savedSkills.id,
  name: savedSkills.name,
  description: savedSkills.description,
  tags: savedSkills.tags,
  notes: savedSkills.notes,
  favorite: savedSkills.favorite,
  sourceName: savedSkills.sourceName,
  files: savedSkills.files,
  totalBytes: savedSkills.totalBytes,
  createdAt: savedSkills.createdAt,
  updatedAt: savedSkills.updatedAt,
};
type SummaryRow = Omit<typeof savedSkills.$inferSelect, "archiveBase64" | "archiveName" | "content">;
function summarize(row: SummaryRow): SkillSummary {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export async function listSkills() {
  if (usesLocalSkillStorage()) return (await localStore()).list();
  const rows = await getDb().select(summaryColumns).from(savedSkills).orderBy(desc(savedSkills.updatedAt));
  return rows.map(summarize);
}

export async function getSkill(id: string): Promise<SkillDetail | null> {
  if (usesLocalSkillStorage()) return (await localStore()).get(id);
  const [row] = await getDb().select({ ...summaryColumns, content: savedSkills.content }).from(savedSkills).where(eq(savedSkills.id, id)).limit(1);
  return row ? { ...summarize(row), content: row.content } : null;
}

export async function saveSkill(input: Awaited<ReturnType<typeof prepareSkillPackage>>) {
  if (usesLocalSkillStorage()) return (await localStore()).save(input);
  const [row] = await getDb().insert(savedSkills).values(input).returning(summaryColumns);
  return summarize(row);
}

export async function updateSkill(id: string, input: Partial<SkillMetadata>, replacement?: Awaited<ReturnType<typeof prepareSkillPackage>>) {
  if (usesLocalSkillStorage()) return (await localStore()).update(id, input, replacement);
  const packageFields = replacement ? {
    content: replacement.content,
    files: replacement.files,
    totalBytes: replacement.totalBytes,
    sourceName: replacement.sourceName,
    archiveName: replacement.archiveName,
    archiveBase64: replacement.archiveBase64,
  } : {};
  const [row] = await getDb().update(savedSkills).set({ ...packageFields, ...input, updatedAt: new Date() }).where(eq(savedSkills.id, id)).returning(summaryColumns);
  return row ? summarize(row) : null;
}

export async function deleteSkill(id: string) {
  if (usesLocalSkillStorage()) return (await localStore()).delete(id);
  const [row] = await getDb().delete(savedSkills).where(eq(savedSkills.id, id)).returning({ id: savedSkills.id });
  return row ?? null;
}

export async function getSkillArchive(id: string) {
  if (usesLocalSkillStorage()) return (await localStore()).archive(id);
  const [row] = await getDb().select({ archiveName: savedSkills.archiveName, archiveBase64: savedSkills.archiveBase64 }).from(savedSkills).where(eq(savedSkills.id, id)).limit(1);
  return row ?? null;
}
