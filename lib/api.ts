import { NextResponse } from "next/server";

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiEnvelope<T>>({ success: true, data }, init);
}

export function apiError(code: string, message: string, status = 400) {
  return NextResponse.json<ApiEnvelope<never>>(
    { success: false, error: { code, message } },
    { status },
  );
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "发生未知错误";
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error("请求内容不是有效的 JSON");
  }
}
