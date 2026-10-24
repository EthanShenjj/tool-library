import type { Credentials } from "google-auth-library";
import { apiError, apiOk, errorMessage } from "@/lib/api";
import { getCredential, removeCredential } from "@/lib/db/queries";
import { createOAuthClient } from "@/lib/google/client";
import { assertSameOrigin } from "@/lib/request";
import { decryptJson } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const saved = await getCredential("oauth");
    let revokeWarning = false;
    if (saved) {
      const tokens = decryptJson<Credentials>(saved.encryptedPayload);
      const token = tokens.refresh_token || tokens.access_token;
      if (token) {
        try {
          await createOAuthClient().revokeToken(token);
        } catch {
          revokeWarning = true;
        }
      }
    }
    await removeCredential("oauth");
    return apiOk({ removed: true, revokeWarning });
  } catch (error) {
    return apiError("DISCONNECT_FAILED", errorMessage(error), 500);
  }
}
