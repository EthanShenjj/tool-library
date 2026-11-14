import type { Metadata } from "next";
import { SkillHub } from "@/components/skill-hub/skill-hub";
import { isDatabaseConfigured } from "@/lib/db";
import { listSkills, usesLocalSkillStorage } from "@/lib/skills/storage";
import type { SkillSummary } from "@/lib/skills/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skill Hub" };

export default async function SkillHubPage() {
  let skills: SkillSummary[] = [];
  let storageError = "";
  const localStorage = usesLocalSkillStorage();
  if (!isDatabaseConfigured() && !localStorage) {
    storageError = "Skill 存储尚未就绪。请配置 DATABASE_URL，并执行 npm run db:migrate。";
  } else {
    try { skills = await listSkills(); }
    catch { storageError = localStorage ? "本地技能库读取失败，请检查项目目录是否可写，然后刷新重试。" : "Skill 读取失败。请检查数据库连接并执行 npm run db:migrate，然后刷新页面重试。"; }
  }
  return <SkillHub initialSkills={skills} storageError={storageError} storageMode={localStorage ? "local" : "database"} />;
}
