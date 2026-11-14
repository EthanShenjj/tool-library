import "server-only";

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SkillDetail, SkillMetadata, SkillSummary } from "./schema";
import type { prepareSkillPackage } from "./package";

type SkillPackage = Awaited<ReturnType<typeof prepareSkillPackage>>;

// Open a short-lived connection per operation so hot reloads and server restarts
// always read the same durable data, without sharing a connection across workers.
export function createLocalSkillStore(filename: string) {
  function withDatabase<T>(action: (db: DatabaseSync) => T): T {
    mkdirSync(dirname(filename), { recursive: true });
    const db = new DatabaseSync(filename, { timeout: 5000 });
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        archive_name TEXT NOT NULL,
        archive_base64 TEXT NOT NULL
      )`);
      return action(db);
    } finally { db.close(); }
  }

  return {
    list(): SkillSummary[] {
      return withDatabase((db) => db.prepare("SELECT summary FROM skills").all()
        .map((row) => JSON.parse(String(row.summary)) as SkillSummary)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
    },
    get(id: string): SkillDetail | null {
      return withDatabase((db) => {
        const row = db.prepare("SELECT summary, content FROM skills WHERE id = ?").get(id);
        return row ? { ...JSON.parse(String(row.summary)) as SkillSummary, content: String(row.content) } : null;
      });
    },
    save(input: SkillPackage): SkillSummary {
      const now = new Date().toISOString();
      const { content, archiveName, archiveBase64, ...metadata } = input;
      const summary: SkillSummary = { ...metadata, id: randomUUID(), createdAt: now, updatedAt: now };
      return withDatabase((db) => {
        db.prepare("INSERT INTO skills (id, summary, content, archive_name, archive_base64) VALUES (?, ?, ?, ?, ?)")
          .run(summary.id, JSON.stringify(summary), content, archiveName, archiveBase64);
        return summary;
      });
    },
    update(id: string, input: Partial<SkillMetadata>, replacement?: SkillPackage): SkillSummary | null {
      return withDatabase((db) => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const row = db.prepare("SELECT summary FROM skills WHERE id = ?").get(id);
          if (!row) { db.exec("COMMIT"); return null; }
          const existing = JSON.parse(String(row.summary)) as SkillSummary;
          const summary: SkillSummary = {
            ...existing, ...input,
            ...(replacement ? { sourceName: replacement.sourceName, files: replacement.files, totalBytes: replacement.totalBytes } : {}),
            updatedAt: new Date().toISOString(),
          };
          if (replacement) {
            db.prepare("UPDATE skills SET summary = ?, content = ?, archive_name = ?, archive_base64 = ? WHERE id = ?")
              .run(JSON.stringify(summary), replacement.content, replacement.archiveName, replacement.archiveBase64, id);
          } else db.prepare("UPDATE skills SET summary = ? WHERE id = ?").run(JSON.stringify(summary), id);
          db.exec("COMMIT");
          return summary;
        } catch (error) { db.exec("ROLLBACK"); throw error; }
      });
    },
    delete(id: string) {
      return withDatabase((db) => db.prepare("DELETE FROM skills WHERE id = ?").run(id).changes ? { id } : null);
    },
    archive(id: string) {
      return withDatabase((db) => {
        const row = db.prepare("SELECT archive_name, archive_base64 FROM skills WHERE id = ?").get(id);
        return row ? { archiveName: String(row.archive_name), archiveBase64: String(row.archive_base64) } : null;
      });
    },
  };
}

export function getLocalSkillStore() {
  return createLocalSkillStore(join(process.env.SKILL_HUB_DATA_DIR || join(process.cwd(), ".data"), "skill-hub.sqlite"));
}
