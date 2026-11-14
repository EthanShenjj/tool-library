import { skillError, skillFailure } from "@/lib/skills/api";
import { skillIdSchema } from "@/lib/skills/schema";
import { getSkillArchive } from "@/lib/skills/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const archive = await getSkillArchive(skillIdSchema.parse((await context.params).id));
    if (!archive) return skillError("NOT_FOUND", "Skill 不存在或已被删除。", 404);
    return new Response(Buffer.from(archive.archiveBase64, "base64"), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="skill.zip"; filename*=UTF-8''${encodeURIComponent(archive.archiveName)}`,
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return skillFailure(error); }
}
