import { z } from "zod";

export const accountSchema = z.object({
  platform: z.string().trim().min(1, "请填写平台名称").max(100, "平台名称最多 100 字"),
  websiteUrl: z.string().trim().max(2000, "网站 URL 过长").refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }, "请输入完整的 http:// 或 https:// 网站地址，且不要在 URL 中包含账号密码"),
  username: z.string().trim().max(320, "账号最多 320 字"),
  // Omitted on edit means keep the current password; an empty string clears it.
  password: z.string().max(4096, "密码过长").optional(),
  notes: z.string().trim().max(5000, "备注最多 5000 字"),
});

export const accountIdSchema = z.uuid();
export type AccountInput = z.infer<typeof accountSchema>;

export type AccountSummary = {
  id: string;
  platform: string;
  websiteUrl: string;
  username: string;
  notes: string;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
};
