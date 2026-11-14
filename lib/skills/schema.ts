import { z } from "zod";

export const MAX_SKILL_BYTES = 3 * 1024 * 1024;
export const MAX_SKILL_FILES = 200;
export const MAX_SKILL_MARKDOWN_BYTES = 256 * 1024;

export const skillMetadataSchema = z.object({
  name: z.string().trim().min(1, "请填写 Skill 名称").max(100, "名称最多 100 字"),
  description: z.string().trim().max(2000, "说明最多 2000 字"),
  tags: z.array(z.string().trim().min(1).max(32, "每个标签最多 32 字")).max(12, "最多添加 12 个标签").transform((tags) => [...new Set(tags)]),
  notes: z.string().trim().max(5000, "备注最多 5000 字"),
  favorite: z.boolean(),
});
export const skillPatchSchema = skillMetadataSchema.partial();
export const skillIdSchema = z.uuid();
export type SkillMetadata = z.infer<typeof skillMetadataSchema>;
export type SkillFile = { path: string; size: number };
export type SkillSummary = SkillMetadata & {
  id: string;
  sourceName: string;
  files: SkillFile[];
  totalBytes: number;
  createdAt: string;
  updatedAt: string;
};
export type SkillDetail = SkillSummary & { content: string };

export function formatSkillSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
