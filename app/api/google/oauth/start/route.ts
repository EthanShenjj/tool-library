import { randomBytes } from "node:crypto";
import { apiError, apiOk, errorMessage } from "@/lib/api";
import { createOAuthClient, GOOGLE_SCOPES } from "@/lib/google/client";
import { encryptJson } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = randomBytes(32).toString("base64url");
    const sealed = encryptJson({ state, expiresAt: Date.now() + 10 * 60 * 1000 });
    const client = createOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: GOOGLE_SCOPES,
      state,
    });
    const response = apiOk({ url });
    response.cookies.set("google_oauth_state", sealed, {
      httpOnly: true,
      sameSite: "lax",
      secure: (process.env.APP_URL || "").startsWith("https://"),
      maxAge: 10 * 60,
      path: "/api/google/oauth",
    });
    return response;
  } catch (error) {
    return apiError("OAUTH_NOT_CONFIGURED", errorMessage(error), 503);
  }
}
