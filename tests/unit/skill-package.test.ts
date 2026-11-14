import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { MAX_SKILL_BYTES, MAX_SKILL_FILES } from "@/lib/skills/schema";
import { parseSkillMarkdown, prepareSkillPackage, readSkillUpload } from "@/lib/skills/package";

const markdown = "---\nname: weekly-review\ndescription: >-\n  整理本周工作，\n  生成周回顾。\nmetadata:\n  tags: [工作效率, 复盘]\n---\n\n# 每周回顾\n\n整理用户的工作笔记。\n";
const file = (content: string | Uint8Array, name = "SKILL.md") => new File([typeof content === "string" ? content : new Uint8Array(content)], name);

describe("Skill packages", () => {
  it("reads folded YAML, nested tags, BOM and CRLF without changing the original content", async () => {
    const source = "\uFEFF" + markdown.replace(/\n/g, "\r\n");
    const result = await prepareSkillPackage([file(source)]);
    expect(result).toMatchObject({ name: "weekly-review", tags: ["工作效率", "复盘"], description: "整理本周工作， 生成周回顾。", content: source });
    const zip = await JSZip.loadAsync(result.archiveBase64, { base64: true });
    expect(await zip.file("weekly-review/SKILL.md")?.async("string")).toBe(source);
  });

  it("supports plain Markdown and requires actual instructions", () => {
    expect(parseSkillMarkdown("# 我的技能\n\n执行步骤").name).toBe("我的技能");
    expect(() => parseSkillMarkdown("---\nname: empty\n---\n")).toThrow("使用说明");
    expect(() => parseSkillMarkdown("---\nname: bad\n")).toThrow("分隔线");
    expect(() => parseSkillMarkdown("---\nname: [\n---\n# Body")).toThrow("YAML");
  });

  it("preserves folders, binary assets and executable permissions through ZIP download", async () => {
    const input = new JSZip();
    input.file("my-skill/SKILL.md", markdown);
    input.file("my-skill/scripts/run.sh", "#!/bin/sh\necho hello", { unixPermissions: 0o100755 });
    input.file("my-skill/assets/logo.bin", new Uint8Array([0, 255, 12, 129]));
    input.file("my-skill/references/details.md", "# Notes");
    input.file("__MACOSX/._SKILL.md", "ignored");
    const result = await prepareSkillPackage([file(await input.generateAsync({ type: "uint8array", platform: "UNIX" }), "my-skill.zip")]);
    expect(result.files.map((entry) => entry.path)).toEqual(["SKILL.md", "assets/logo.bin", "references/details.md", "scripts/run.sh"]);
    const zip = await JSZip.loadAsync(result.archiveBase64, { base64: true });
    expect(await zip.file("weekly-review/assets/logo.bin")?.async("uint8array")).toEqual(new Uint8Array([0, 255, 12, 129]));
    expect(Number(zip.file("weekly-review/scripts/run.sh")?.unixPermissions) & 0o777).toBe(0o755);
  });

  it("keeps browser folder paths through multipart parsing", async () => {
    const form = new FormData();
    form.append("files", file(markdown));
    form.append("files", file("reference", "notes.md"));
    form.append("paths", JSON.stringify(["my-skill/SKILL.md", "my-skill/references/notes.md"]));
    const result = await readSkillUpload(new Request("http://localhost/api/skills", { method: "POST", body: form }));
    expect(result.sourceName).toBe("my-skill");
    expect(result.files.map((entry) => entry.path)).toEqual(["SKILL.md", "references/notes.md"]);
  });

  it("rejects unsupported files, multiple skills, malformed paths and invalid UTF-8", async () => {
    await expect(prepareSkillPackage([file("content", "notes.txt")])).rejects.toThrow("没有找到 SKILL.md");
    await expect(prepareSkillPackage([file(markdown), file(markdown)], ["first/SKILL.md", "second/SKILL.md"])).rejects.toThrow("多个 Skill");
    await expect(prepareSkillPackage([file(markdown)], ["../SKILL.md"])).rejects.toThrow("文件路径");
    await expect(prepareSkillPackage([file(new Uint8Array([0xff, 0xfe]))])).rejects.toThrow("UTF-8");
    await expect(prepareSkillPackage([file(markdown)], [])).rejects.toThrow("文件路径信息");
  });

  it("rejects ZIP traversal before sanitized paths can be trusted", async () => {
    const zip = new JSZip();
    zip.file("../../SKILL.md", markdown);
    await expect(prepareSkillPackage([file(await zip.generateAsync({ type: "uint8array" }), "bad.zip")])).rejects.toThrow("文件路径");
  });

  it("rejects symlinks and damaged archives", async () => {
    const zip = new JSZip();
    zip.file("SKILL.md", "target", { unixPermissions: 0o120777 });
    await expect(prepareSkillPackage([file(await zip.generateAsync({ type: "uint8array", platform: "UNIX" }), "link.zip")])).rejects.toThrow("符号链接");
    await expect(prepareSkillPackage([file("not a zip", "bad.zip")])).rejects.toThrow("无法读取 ZIP");
  });

  it("bounds compressed expansion, file counts and Markdown size", async () => {
    const zip = new JSZip();
    zip.file("SKILL.md", markdown);
    zip.file("huge.txt", "a".repeat(MAX_SKILL_BYTES + 1));
    const compressed = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    expect(compressed.length).toBeLessThan(MAX_SKILL_BYTES);
    await expect(prepareSkillPackage([file(compressed, "bomb.zip")])).rejects.toThrow("解压后的总大小");
    await expect(prepareSkillPackage(Array.from({ length: MAX_SKILL_FILES + 1 }, () => file(markdown)))).rejects.toThrow("200");
    await expect(prepareSkillPackage([file("x".repeat(MAX_SKILL_BYTES + 1))])).rejects.toThrow("总大小");
    expect(() => parseSkillMarkdown("x".repeat(256 * 1024 + 1))).toThrow("256 KB");
  });

  it("rejects YAML aliases rather than expanding recursive metadata", () => {
    expect(() => parseSkillMarkdown("---\nname: &a [*a]\ndescription: *a\n---\n# Body")).toThrow("YAML");
  });
});
