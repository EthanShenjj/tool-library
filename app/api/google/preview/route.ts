import { google } from "googleapis";
import { z } from "zod";
import { apiError, apiOk, readJson } from "@/lib/api";
import { updateConnector } from "@/lib/db/queries";
import { friendlyGoogleError, getGoogleAuth } from "@/lib/google/client";
import { buildPreviewRange, generatedColumnName } from "@/lib/google/range";
import { assertSameOrigin } from "@/lib/request";

export const runtime = "nodejs";

const previewSchema = z.object({
  mode: z.enum(["service_account", "oauth"]),
  spreadsheetId: z.string().regex(/^[\w-]{20,}$/),
  sheet: z.string().trim().min(1).max(200),
  range: z.string().trim().min(1).max(100),
  headerRow: z.boolean(),
  connectorId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let input: z.infer<typeof previewSchema> | null = null;
  try {
    assertSameOrigin(request);
    input = previewSchema.parse(await readJson(request));
    const auth = await getGoogleAuth(input.mode);
    const previewRange = buildPreviewRange(input.sheet, input.range, input.headerRow);
    const startedAt = Date.now();
    const response = await google.sheets({ version: "v4", auth }).spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: previewRange,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const values = response.data.values || [];
    const maxColumns = Math.min(50, values.reduce((max, row) => Math.max(max, row.length), 0));
    const headers = Array.from({ length: maxColumns }, (_, index) =>
      input!.headerRow ? String(values[0]?.[index] || generatedColumnName(index)) : generatedColumnName(index),
    );
    const rows = (input.headerRow ? values.slice(1) : values).slice(0, 100);
    if (input.connectorId) {
      await updateConnector(input.connectorId, { testStatus: "passed", lastTestedAt: new Date() });
    }
    return apiOk({
      range: response.data.range || previewRange,
      headers,
      rows,
      rowCount: rows.length,
      fieldCount: headers.length,
      elapsedMs: Date.now() - startedAt,
      truncated: rows.length === 100 || maxColumns === 50,
    });
  } catch (error) {
    if (input?.connectorId) {
      await updateConnector(input.connectorId, { testStatus: "failed", lastTestedAt: new Date() }).catch(() => undefined);
    }
    if (error instanceof z.ZodError || (error instanceof Error && error.message.includes("数据范围"))) {
      return apiError("INVALID_PREVIEW_REQUEST", error instanceof Error ? error.message : "预览参数无效。", 400);
    }
    const mode = input?.mode || "oauth";
    const friendly = friendlyGoogleError(error, mode);
    return apiError(friendly.code, friendly.message, friendly.status);
  }
}
