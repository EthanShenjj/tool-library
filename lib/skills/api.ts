import { ZodError } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { SkillInputError } from "./package";

export function skillOk<T>(data: T, status = 200) {
  return apiOk(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function skillError(code: string, message: string, status: number) {
  const response = apiError(code, message, status);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export function skillFailure(error: unknown) {
  if (error instanceof SkillInputError) return skillError("INVALID_SKILL", error.message, error.status);
  if (error instanceof ZodError) return skillError("INVALID_SKILL", error.issues[0]?.message ?? "Skill 信息无效。", 400);
  if (error instanceof Error && error.message === "跨站请求已被拒绝") return skillError("FORBIDDEN", error.message, 403);
  if (error instanceof Error && error.message === "请求内容不是有效的 JSON") return skillError("INVALID_JSON", error.message, 400);
  return skillError("SKILL_STORAGE_ERROR", "Skill 保存失败，请检查存储是否可用后重试。", 503);
}
