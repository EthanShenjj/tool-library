import "server-only";

import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import { getCredential, upsertCredential } from "@/lib/db/queries";
import type { CredentialMode } from "@/lib/db/schema";
import { decryptJson, encryptJson } from "@/lib/security";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "openid",
  "email",
  "profile",
];

export const REQUIRED_GOOGLE_SCOPES = GOOGLE_SCOPES.slice(0, 2);

export type ServiceAccountPayload = {
  type: "service_account";
  client_email: string;
  private_key: string;
  project_id?: string;
  token_uri?: string;
};

export function oauthRedirectUri() {
  const origin = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${origin}/api/google/oauth/callback`;
}

export function createOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth 尚未配置，请设置 GOOGLE_CLIENT_ID 与 GOOGLE_CLIENT_SECRET");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    oauthRedirectUri(),
  );
}

export function hasRequiredScopes(scope: string | null | undefined) {
  const granted = new Set(String(scope || "").split(/\s+/).filter(Boolean));
  return REQUIRED_GOOGLE_SCOPES.every((item) => granted.has(item));
}

export async function getGoogleAuth(mode: CredentialMode) {
  const credential = await getCredential(mode);
  if (!credential) {
    throw new Error(mode === "oauth" ? "尚未连接 Google OAuth" : "尚未配置 Service Account");
  }

  if (mode === "service_account") {
    const payload = decryptJson<ServiceAccountPayload>(credential.encryptedPayload);
    return new google.auth.JWT({
      email: payload.client_email,
      key: payload.private_key,
      scopes: REQUIRED_GOOGLE_SCOPES,
    });
  }

  const tokens = decryptJson<Credentials>(credential.encryptedPayload);
  const client = createOAuthClient();
  client.setCredentials(tokens);
  client.on("tokens", (freshTokens) => {
    const merged = { ...tokens, ...freshTokens };
    void upsertCredential({
      mode: "oauth",
      encryptedPayload: encryptJson(merged),
      email: credential.email,
      permissionsReady: credential.permissionsReady,
    });
  });
  return client;
}

export function friendlyGoogleError(error: unknown, mode: CredentialMode) {
  const candidate = error as { code?: number; message?: string; response?: { status?: number } };
  const status = Number(candidate.code || candidate.response?.status || 500);
  if (status === 401) return { status, code: "GOOGLE_UNAUTHORIZED", message: "Google 授权已失效，请重新连接账号。" };
  if (status === 403) return { status, code: "GOOGLE_FORBIDDEN", message: mode === "oauth" ? "当前 Google 账号没有访问该表格的权限。" : "请将表格以查看者权限共享给当前 Service Account。" };
  if (status === 404) return { status, code: "SHEET_NOT_FOUND", message: "找不到该表格，请检查链接和共享权限。" };
  if (status === 429) return { status, code: "GOOGLE_RATE_LIMITED", message: "Google API 请求过于频繁，请稍后重试。" };
  return { status: 502, code: "GOOGLE_API_ERROR", message: "Google 服务暂时不可用，请稍后重试。" };
}
