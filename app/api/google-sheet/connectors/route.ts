import { apiError, apiOk, errorMessage, readJson } from "@/lib/api";
import { createConnector, getConnector, listConnectors } from "@/lib/db/queries";
import { assertSameOrigin } from "@/lib/request";
import { connectorSchema } from "@/lib/validation/connector";

export const runtime = "nodejs";

export async function GET() {
  try {
    return apiOk({ connectors: await listConnectors() });
  } catch (error) {
    return apiError("DATABASE_ERROR", errorMessage(error), 503);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJson(request) as { duplicateFrom?: string; name?: string };
    if (body.duplicateFrom) {
      const source = await getConnector(body.duplicateFrom);
      if (!source) return apiError("NOT_FOUND", "找不到要复制的连接器。", 404);
      const copy = await createConnector({
        name: body.name?.trim() || `${source.name} 副本`,
        authMode: source.authMode,
        spreadsheetId: source.spreadsheetId,
        sheetUrl: source.sheetUrl,
        sheet: source.sheet,
        range: source.range,
        headerRow: source.headerRow,
        primaryKey: source.primaryKey,
        importMode: source.importMode,
        frequency: source.frequency,
        scheduleTime: source.scheduleTime,
        timezone: source.timezone,
        fieldMapping: source.fieldMapping,
        testStatus: "untested",
      });
      return apiOk(copy, { status: 201 });
    }

    const input = connectorSchema.parse(body);
    const { testPassed, ...values } = input;
    const connector = await createConnector({
      ...values,
      testStatus: testPassed ? "passed" : "untested",
      lastTestedAt: testPassed ? new Date() : null,
    });
    return apiOk(connector, { status: 201 });
  } catch (error) {
    return apiError("INVALID_CONNECTOR", errorMessage(error), 400);
  }
}
