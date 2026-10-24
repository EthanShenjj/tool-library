import { ZodError } from "zod";
import { apiError, apiOk } from "@/lib/api";

export function accountOk<T>(data: T, status = 200) {
  return apiOk(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function accountError(code: string, message: string, status: number) {
  const response = apiError(code, message, status);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function accountFailure(error: unknown) {
  if (error instanceof ZodError) return accountError("INVALID_ACCOUNT", error.issues[0]?.message ?? "账号信息无效", 400);
  if (error instanceof Error && error.message === "跨站请求已被拒绝") return accountError("FORBIDDEN", error.message, 403);
  if (error instanceof Error && error.message === "请求内容不是有效的 JSON") return accountError("INVALID_JSON", error.message, 400);
  // Database errors can include query parameters; never return them to the browser.
  return accountError("ACCOUNT_STORAGE_ERROR", "账号操作失败，请检查数据库迁移和加密密钥配置后重试。", 503);
}
