import { readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/request";
import { skillError, skillFailure, skillOk } from "@/lib/skills/api";
import { readSkillUpload } from "@/lib/skills/package";
import { skillIdSchema, skillPatchSchema } from "@/lib/skills/schema";
import { deleteSkill, getSkill, updateSkill } from "@/lib/skills/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const notFound = () => skillError("NOT_FOUND", "Skill 不存在或已被删除。", 404);

export async function GET(_request: Request, context: Context) {
  try {
    const skill = await getSkill(skillIdSchema.parse((await context.params).id));
    return skill ? skillOk(skill) : notFound();
  } catch (error) { return skillFailure(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const id = skillIdSchema.parse((await context.params).id);
    const replacement = request.headers.get("content-type")?.startsWith("multipart/form-data") ? await readSkillUpload(request) : undefined;
    const input = replacement ? {} : skillPatchSchema.parse(await readJson(request));
    const skill = await updateSkill(id, input, replacement);
    return skill ? skillOk(skill) : notFound();
  } catch (error) { return skillFailure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    return await deleteSkill(skillIdSchema.parse((await context.params).id)) ? skillOk({ removed: true }) : notFound();
  } catch (error) { return skillFailure(error); }
}
