import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type CredentialMode = "service_account" | "oauth";
export type FieldMapping = { source: string; target: string };

export const googleCredentials = pgTable("google_credentials", {
  mode: text("mode").$type<CredentialMode>().primaryKey(),
  encryptedPayload: text("encrypted_payload").notNull(),
  email: text("email"),
  permissionsReady: boolean("permissions_ready").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sheetConnectors = pgTable("sheet_connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  authMode: text("auth_mode").$type<CredentialMode>().notNull(),
  spreadsheetId: text("spreadsheet_id").notNull(),
  sheetUrl: text("sheet_url").notNull().default(""),
  sheet: text("sheet").notNull(),
  range: text("range").notNull().default("A:Z"),
  headerRow: boolean("header_row").notNull().default(true),
  primaryKey: text("primary_key").notNull().default("user_id"),
  importMode: text("import_mode").notNull().default("upsert"),
  frequency: text("frequency").notNull().default("daily"),
  scheduleTime: text("schedule_time").notNull().default("03:00"),
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  fieldMapping: jsonb("field_mapping").$type<FieldMapping[]>().notNull().default([]),
  testStatus: text("test_status").notNull().default("untested"),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoogleCredential = typeof googleCredentials.$inferSelect;
export type SheetConnector = typeof sheetConnectors.$inferSelect;
export type NewSheetConnector = typeof sheetConnectors.$inferInsert;

export const platformAccounts = pgTable("platform_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").notNull(),
  websiteUrl: text("website_url").notNull().default(""),
  encryptedPayload: text("encrypted_payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("platform_accounts_updated_at_idx").on(table.updatedAt.desc())]);

export type PlatformAccount = typeof platformAccounts.$inferSelect;

export const savedSkills = pgTable("saved_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  favorite: boolean("favorite").notNull().default(false),
  sourceName: text("source_name").notNull(),
  content: text("content").notNull(),
  files: jsonb("files").$type<{ path: string; size: number }[]>().notNull(),
  totalBytes: integer("total_bytes").notNull(),
  archiveName: text("archive_name").notNull(),
  archiveBase64: text("archive_base64").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("saved_skills_updated_at_idx").on(table.updatedAt.desc())]);
