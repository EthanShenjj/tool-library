import { z } from "zod";

export const credentialModeSchema = z.enum(["service_account", "oauth"]);

export const fieldMappingSchema = z.object({
  source: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(200),
});

export const connectorSchema = z.object({
  name: z.string().trim().min(1, "请输入连接器名称").max(80),
  authMode: credentialModeSchema,
  spreadsheetId: z.string().trim().regex(/^[\w-]{20,}$/, "Spreadsheet ID 无效"),
  sheetUrl: z.string().trim().max(500),
  sheet: z.string().trim().min(1, "请选择工作表").max(200),
  range: z.string().trim().min(1).max(100),
  headerRow: z.boolean(),
  primaryKey: z.string().trim().min(1).max(200),
  importMode: z.enum(["append", "upsert", "replace"]),
  frequency: z.enum(["hourly", "daily", "weekly"]),
  scheduleTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.enum(["Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "UTC"]),
  fieldMapping: z.array(fieldMappingSchema).max(100),
  testPassed: z.boolean(),
});

export const serviceAccountSchema = z.object({
  type: z.literal("service_account"),
  client_email: z.string().email(),
  private_key: z.string().min(100),
  project_id: z.string().optional(),
  token_uri: z.string().url().optional(),
});

export type ConnectorInput = z.infer<typeof connectorSchema>;
