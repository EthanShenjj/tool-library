import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const storage = vi.hoisted(() => ({ listSkills: vi.fn(), saveSkill: vi.fn(), getSkill: vi.fn(), updateSkill: vi.fn(), deleteSkill: vi.fn(), getSkillArchive: vi.fn() }));
vi.mock("@/lib/skills/storage", () => storage);

import { GET, POST } from "@/app/api/skills/route";
import { GET as detail, PATCH, DELETE } from "@/app/api/skills/[id]/route";
import { GET as download } from "@/app/api/skills/[id]/download/route";

const id = "223d75ce-f1ca-4d3e-9c84-fde59cf094a9";
const context = () => ({ params: Promise.resolve({ id }) });
const json = (method: string, body?: unknown, origin = "http://localhost") => new Request(`http://localhost/api/skills/${id}`, { method, headers: { origin, "content-type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const upload = (method = "POST", content = "---\nname: example\ndescription: Test\n---\n# Body\nInstructions", origin = "http://localhost") => {
  const form = new FormData();
  form.append("files", new File([content], "SKILL.md"));
  return new Request("http://localhost/api/skills", { method, headers: { origin }, body: form });
};
beforeEach(() => vi.resetAllMocks());

describe("Skill Hub API", () => {
  it("parses and persists an actual multipart upload, returning metadata only", async () => {
    storage.saveSkill.mockResolvedValue({ id, name: "example" });
    const response = await POST(upload());
    expect(response.status).toBe(201);
    const stored = storage.saveSkill.mock.calls[0][0];
    expect(stored).toMatchObject({ name: "example", description: "Test", files: [{ path: "SKILL.md" }] });
    expect(stored.archiveBase64).toBeTruthy();
    expect(await response.json()).toEqual({ success: true, data: { id, name: "example" } });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects invalid upload and invalid metadata before writing", async () => {
    expect((await POST(upload("POST", ""))).status).toBe(400);
    expect((await PATCH(json("PATCH", { name: "" }), context())).status).toBe(400);
    expect(storage.saveSkill).not.toHaveBeenCalled();
    expect(storage.updateSkill).not.toHaveBeenCalled();
  });

  it("replaces package files separately from already curated metadata", async () => {
    storage.updateSkill.mockResolvedValue({ id, name: "Custom name" });
    expect((await PATCH(upload("PATCH"), context())).status).toBe(200);
    expect(storage.updateSkill).toHaveBeenCalledWith(id, {}, expect.objectContaining({ name: "example", archiveBase64: expect.any(String) }));
  });

  it("supports independent favorite and metadata changes", async () => {
    storage.updateSkill.mockResolvedValue({ id, favorite: true });
    expect((await PATCH(json("PATCH", { favorite: true }), context())).status).toBe(200);
    expect(storage.updateSkill).toHaveBeenCalledWith(id, { favorite: true }, undefined);
  });

  it("returns readable missing-record responses and no caching", async () => {
    storage.listSkills.mockResolvedValue([]);
    const response = await GET();
    expect(await response.json()).toEqual({ success: true, data: { skills: [] } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    storage.getSkill.mockResolvedValue(null);
    storage.updateSkill.mockResolvedValue(null);
    storage.deleteSkill.mockResolvedValue(null);
    storage.getSkillArchive.mockResolvedValue(null);
    expect((await detail(json("GET"), context())).status).toBe(404);
    expect((await PATCH(json("PATCH", { notes: "new" }), context())).status).toBe(404);
    expect((await DELETE(json("DELETE"), context())).status).toBe(404);
    expect((await download(json("GET"), context())).status).toBe(404);
  });

  it("downloads a complete ZIP with safe attachment headers", async () => {
    const zip = new JSZip().file("example/SKILL.md", "Instructions").file("example/scripts/run.sh", "echo hi");
    storage.getSkillArchive.mockResolvedValue({ archiveName: "中文技能.zip", archiveBase64: await zip.generateAsync({ type: "base64" }) });
    const response = await download(json("GET"), context());
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(encodeURIComponent("中文技能.zip"));
    const restored = await JSZip.loadAsync(await response.arrayBuffer());
    expect(await restored.file("example/scripts/run.sh")?.async("string")).toBe("echo hi");
  });

  it("rejects cross-origin mutations and malformed IDs", async () => {
    expect((await POST(upload("POST", "# Content", "https://evil.example"))).status).toBe(403);
    expect((await PATCH(json("PATCH", { favorite: true }, "https://evil.example"), context())).status).toBe(403);
    expect((await DELETE(json("DELETE", undefined, "https://evil.example"), context())).status).toBe(403);
    expect((await detail(json("GET"), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(400);
    expect(storage.saveSkill).not.toHaveBeenCalled();
    expect(storage.updateSkill).not.toHaveBeenCalled();
    expect(storage.deleteSkill).not.toHaveBeenCalled();
    expect(storage.getSkill).not.toHaveBeenCalled();
  });

  it("never exposes database query content in errors", async () => {
    storage.listSkills.mockRejectedValue(new Error("private SQL query content"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private");
  });
});
