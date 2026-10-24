import { google } from "googleapis";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { friendlyGoogleError, getGoogleAuth } from "@/lib/google/client";

export const runtime = "nodejs";

const querySchema = z.object({
  mode: z.enum(["service_account", "oauth"]),
  spreadsheetId: z.string().regex(/^[\w-]{20,}$/),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiError("INVALID_QUERY", "Spreadsheet ID 或认证方式无效。", 400);
  try {
    const auth = await getGoogleAuth(parsed.data.mode);
    const response = await google.sheets({ version: "v4", auth }).spreadsheets.get({
      spreadsheetId: parsed.data.spreadsheetId,
      fields: "properties(title),sheets(properties(sheetId,title,index))",
    });
    return apiOk({
      title: response.data.properties?.title || "未命名表格",
      sheets: (response.data.sheets || []).map((sheet) => ({
        id: sheet.properties?.sheetId,
        title: sheet.properties?.title || "",
        index: sheet.properties?.index || 0,
      })),
    });
  } catch (error) {
    const friendly = friendlyGoogleError(error, parsed.data.mode);
    return apiError(friendly.code, friendly.message, friendly.status);
  }
}
