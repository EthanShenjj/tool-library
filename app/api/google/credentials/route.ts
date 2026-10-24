import { google } from "googleapis";
import { z } from "zod";
import { apiError, apiOk, errorMessage, readJson } from "@/lib/api";
import { isDatabaseConfigured } from "@/lib/db";
import { listCredentialStatuses, removeCredential, upsertCredential } from "@/lib/db/queries";
import { REQUIRED_GOOGLE_SCOPES } from "@/lib/google/client";
import { assertSameOrigin } from "@/lib/request";
import { encryptJson } from "@/lib/security";
import { serviceAccountSchema } from "@/lib/validation/connector";

export const runtime = "nodejs";

export async function GET() {
  if (!isDatabaseConfigured()) return apiOk({ databaseConfigured: false, credentials: [] });
  try {
    return apiOk({ databaseConfigured: true, credentials: await listCredentialStatuses() });
  } catch {
    return apiError("DATABASE_ERROR", "无法读取 Google 连接状态。", 500);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = z.object({ json: z.union([z.string(), z.record(z.string(), z.unknown())]) }).parse(await readJson(request));
    const raw = typeof body.json === "string" ? JSON.parse(body.json) : body.json;
    const credential = serviceAccountSchema.parse(raw);
    const auth = new google.auth.JWT({
      email: credential.client_email,
      key: credential.private_key,
      scopes: REQUIRED_GOOGLE_SCOPES,
    });
    await google.drive({ version: "v3", auth }).files.list({ pageSize: 1, fields: "files(id)" });
    const saved = await upsertCredential({
      mode: "service_account",
      encryptedPayload: encryptJson(credential),
      email: credential.client_email,
      permissionsReady: true,
    });
    return apiOk(saved, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return apiError("INVALID_CREDENTIAL", "Service Account JSON 格式或字段无效。", 400);
    }
    const message = errorMessage(error);
    if (message.includes("DATABASE_URL") || message.includes("ENCRYPTION_KEY")) {
      return apiError("SERVER_NOT_CONFIGURED", message, 503);
    }
    return apiError("CREDENTIAL_REJECTED", "Google 无法验证该 Service Account，请检查私钥和 API 配置。", 400);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await removeCredential("service_account");
    return apiOk({ removed: true });
  } catch (error) {
    return apiError("DELETE_FAILED", errorMessage(error), 500);
  }
}
