import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { upsertCredential } from "@/lib/db/queries";
import { createOAuthClient, hasRequiredScopes } from "@/lib/google/client";
import { decryptJson, encryptJson } from "@/lib/security";

export const runtime = "nodejs";

function settingsRedirect(request: NextRequest, result: string) {
  return new URL(`/tools/google-sheet/settings?oauth=${result}`, request.url);
}

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("google_oauth_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const denied = request.nextUrl.searchParams.get("error");

  try {
    if (denied) throw new Error("denied");
    if (!cookie || !state || !code) throw new Error("missing_state");
    const saved = decryptJson<{ state: string; expiresAt: number }>(cookie);
    if (saved.state !== state || saved.expiresAt < Date.now()) throw new Error("expired_state");

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const userInfo = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    const permissionsReady = hasRequiredScopes(tokens.scope);
    await upsertCredential({
      mode: "oauth",
      encryptedPayload: encryptJson(tokens),
      email: userInfo.data.email,
      permissionsReady,
    });
    const response = NextResponse.redirect(settingsRedirect(request, permissionsReady ? "success" : "missing_scopes"));
    response.cookies.delete("google_oauth_state");
    return response;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    const response = NextResponse.redirect(settingsRedirect(request, encodeURIComponent(reason)));
    response.cookies.delete("google_oauth_state");
    return response;
  }
}
