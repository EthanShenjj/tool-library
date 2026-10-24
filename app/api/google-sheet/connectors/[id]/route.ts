import { apiError, apiOk, errorMessage, readJson } from "@/lib/api";
import { deleteConnector, getConnector, updateConnector } from "@/lib/db/queries";
import { assertSameOrigin } from "@/lib/request";
import { connectorSchema } from "@/lib/validation/connector";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  try {
    const connector = await getConnector(id);
    return connector ? apiOk(connector) : apiError("NOT_FOUND", "连接器不存在。", 404);
  } catch (error) {
    return apiError("DATABASE_ERROR", errorMessage(error), 503);
  }
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  try {
    assertSameOrigin(request);
    if (!(await getConnector(id))) return apiError("NOT_FOUND", "连接器不存在。", 404);
    const input = connectorSchema.parse(await readJson(request));
    const { testPassed, ...values } = input;
    const connector = await updateConnector(id, {
      ...values,
      testStatus: testPassed ? "passed" : "untested",
      lastTestedAt: testPassed ? new Date() : null,
    });
    return apiOk(connector);
  } catch (error) {
    return apiError("INVALID_CONNECTOR", errorMessage(error), 400);
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  try {
    assertSameOrigin(request);
    const deleted = await deleteConnector(id);
    return deleted ? apiOk({ removed: true }) : apiError("NOT_FOUND", "连接器不存在。", 404);
  } catch (error) {
    return apiError("DELETE_FAILED", errorMessage(error), 500);
  }
}
