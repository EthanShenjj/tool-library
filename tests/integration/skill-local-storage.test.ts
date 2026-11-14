import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { GET, POST } from "@/app/api/skills/route";
import { GET as detail, PATCH, DELETE } from "@/app/api/skills/[id]/route";
import { GET as download } from "@/app/api/skills/[id]/download/route";
import { createLocalSkillStore } from "@/lib/skills/local-storage";
import { usesLocalSkillStorage } from "@/lib/skills/storage";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "skill-hub-local-test-"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("SKILL_HUB_DATA_DIR", directory);
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (method: string, data?: unknown) => new Request("http://localhost/api/skills", { method, headers: { origin: "http://localhost", "content-type": "application/json" }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
async function zipRequest(method = "POST", body = "First version") {
  const zip = new JSZip();
  zip.file("my-skill/SKILL.md", `---\nname: local-test\ndescription: Uploaded from ZIP\n---\n# Instructions\n${body}`);
  zip.file("my-skill/assets/data.bin", new Uint8Array([0, 255, 127]));
  const form = new FormData();
  form.append("files", new File([new Uint8Array(await zip.generateAsync({ type: "uint8array" }))], "my-skill.zip"));
  return new Request("http://localhost/api/skills", { method, headers: { origin: "http://localhost" }, body: form });
}

describe("local Skill Hub with real SQLite persistence", () => {
  it("uploads ZIP, lists it, reopens the database and downloads identical attachments", async () => {
    expect(usesLocalSkillStorage()).toBe(true);
    const uploaded = await POST(await zipRequest());
    expect(uploaded.status).toBe(201);
    const { data: skill } = await uploaded.json();
    expect(skill).toMatchObject({ name: "local-test", sourceName: "my-skill.zip", files: [{ path: "SKILL.md" }, { path: "assets/data.bin" }] });
    expect(skill).not.toHaveProperty("archiveBase64");
    const listed = await (await GET()).json();
    expect(listed.data.skills).toEqual([skill]);
    const reopened = createLocalSkillStore(join(directory, "skill-hub.sqlite"));
    expect(reopened.list()).toEqual([skill]);
    expect(reopened.get(skill.id)?.content).toContain("First version");
    const response = await download(request("GET"), context(skill.id));
    expect(response.status).toBe(200);
    const restored = await JSZip.loadAsync(await response.arrayBuffer());
    expect(await restored.file("local-test/assets/data.bin")?.async("uint8array")).toEqual(new Uint8Array([0, 255, 127]));
  });

  it("persists edits and favorites, replaces ZIP without losing metadata, and deletes the record", async () => {
    const { data: skill } = await (await POST(await zipRequest())).json();
    const fields = { name: "我的技能", tags: ["常用"], notes: "周一使用", favorite: true };
    expect((await PATCH(request("PATCH", fields), context(skill.id))).status).toBe(200);
    expect((await PATCH(await zipRequest("PATCH", "Second version"), context(skill.id))).status).toBe(200);
    const updated = await (await detail(request("GET"), context(skill.id))).json();
    expect(updated.data).toMatchObject({ ...fields, createdAt: skill.createdAt });
    expect(updated.data.content).toContain("Second version");
    expect((await DELETE(request("DELETE"), context(skill.id))).status).toBe(200);
    expect((await (await GET()).json()).data.skills).toEqual([]);
    expect((await detail(request("GET"), context(skill.id))).status).toBe(404);
    expect((await download(request("GET"), context(skill.id))).status).toBe(404);
  });

  it("does not fall back to machine-local storage in Vercel or when PostgreSQL is configured", () => {
    vi.stubEnv("VERCEL", "1");
    expect(usesLocalSkillStorage()).toBe(false);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://configured");
    expect(usesLocalSkillStorage()).toBe(false);
  });
});
