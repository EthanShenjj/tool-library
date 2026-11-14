import type { ApiEnvelope } from "@/lib/api";

export async function skillRequest<T>(url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method, cache: "no-store", signal,
    ...(body instanceof FormData ? { body } : body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  let result: ApiEnvelope<T>;
  try { result = await response.json(); }
  catch { throw new Error("服务暂时不可用，请稍后重试。"); }
  if (!result.success) throw new Error(result.error.message);
  if (!response.ok) throw new Error("Skill 操作失败，请重试。");
  return result.data;
}

export function skillMessage(error: unknown) { return error instanceof Error ? error.message : "操作失败，请重试。"; }

export async function downloadSkill(id: string, name: string) {
  const response = await fetch(`/api/skills/${id}/download`, { cache: "no-store" });
  if (!response.ok) {
    const result = await response.json() as ApiEnvelope<never>;
    throw new Error(!result.success ? result.error.message : "下载失败，请重试。");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
