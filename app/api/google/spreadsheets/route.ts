import { google } from "googleapis";
import { apiError, apiOk } from "@/lib/api";
import { friendlyGoogleError, getGoogleAuth } from "@/lib/google/client";
import { credentialModeSchema } from "@/lib/validation/connector";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const modeResult = credentialModeSchema.safeParse(new URL(request.url).searchParams.get("mode"));
  if (!modeResult.success) return apiError("INVALID_MODE", "认证方式无效。", 400);
  try {
    const auth = await getGoogleAuth(modeResult.data);
    const response = await google.drive({ version: "v3", auth }).files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id,name,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 50,
    });
    return apiOk({ files: response.data.files || [] });
  } catch (error) {
    const friendly = friendlyGoogleError(error, modeResult.data);
    return apiError(friendly.code, friendly.message, friendly.status);
  }
}
