import { assertSameOrigin } from "@/lib/request";
import { skillFailure, skillOk } from "@/lib/skills/api";
import { readSkillUpload } from "@/lib/skills/package";
import { listSkills, saveSkill } from "@/lib/skills/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return skillOk({ skills: await listSkills() }); }
  catch (error) { return skillFailure(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return skillOk(await saveSkill(await readSkillUpload(request)), 201);
  } catch (error) { return skillFailure(error); }
}
