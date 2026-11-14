import "server-only";

import JSZip from "jszip";
import { Readable } from "node:stream";
import { parse } from "yaml";
import { MAX_SKILL_BYTES, MAX_SKILL_FILES, MAX_SKILL_MARKDOWN_BYTES, skillMetadataSchema } from "./schema";

export class SkillInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type PackageFile = { path: string; data: Buffer; unixPermissions?: number | string | null };
const ignoredParts = new Set(["__MACOSX", ".DS_Store", ".git", "node_modules", ".venv"]);

function validatePath(path: string) {
  if (!path || path.length > 500 || /[\\\x00-\x1f]/.test(path) || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").some((part) => part === ".." || part === "." || !part)) {
    throw new SkillInputError("技能包包含无效的文件路径，请重新打包后上传。");
  }
}

function ignored(path: string) { return path.split("/").some((part) => ignoredParts.has(part)); }

async function unpackZip(buffer: Buffer): Promise<PackageFile[]> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer); }
  catch { throw new SkillInputError("无法读取 ZIP，请确认文件未损坏且未加密。"); }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_SKILL_FILES) throw new SkillInputError(`每个技能包最多包含 ${MAX_SKILL_FILES} 个文件。`);
  const files: PackageFile[] = [];
  let total = 0;
  for (const entry of entries) {
    validatePath(entry.unsafeOriginalName ?? entry.name);
    if (ignored(entry.name)) continue;
    const mode = typeof entry.unixPermissions === "string" ? parseInt(entry.unixPermissions, 8) : entry.unixPermissions;
    if (mode && (mode & 0o170000) === 0o120000) throw new SkillInputError("技能包不能包含符号链接，请改为实际文件后上传。");
    // Consume a bounded stream instead of allocating the full decompressed file.
    const stream = new Readable().wrap(entry.nodeStream());
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of stream) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total > MAX_SKILL_BYTES) throw new SkillInputError("技能包解压后的总大小不能超过 3 MB。", 413);
        chunks.push(bytes);
      }
    } catch (error) {
      if (error instanceof SkillInputError) throw error;
      throw new SkillInputError("ZIP 文件内容损坏，请重新打包后上传。");
    }
    files.push({ path: entry.name, data: Buffer.concat(chunks), unixPermissions: entry.unixPermissions });
  }
  return files;
}

export function parseSkillMarkdown(content: string) {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (Buffer.byteLength(normalized) > MAX_SKILL_MARKDOWN_BYTES) throw new SkillInputError("SKILL.md 不能超过 256 KB。");
  let metadata: Record<string, unknown> = {};
  let body = normalized;
  if (normalized.startsWith("---\n")) {
    const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!match) throw new SkillInputError("SKILL.md 的 YAML 信息缺少结束分隔线 ---。");
    try {
      const parsed: unknown = parse(match[1], { schema: "failsafe", maxAliasCount: 0, logLevel: "error" });
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
    } catch { throw new SkillInputError("SKILL.md 的 YAML 信息格式有误，请检查名称、说明和缩进。"); }
    body = normalized.slice(match[0].length);
  }
  if (!body.trim()) throw new SkillInputError("SKILL.md 需要包含技能使用说明。");
  const nested = metadata.metadata && typeof metadata.metadata === "object" ? metadata.metadata as Record<string, unknown> : {};
  const rawTags = metadata.tags ?? nested.tags;
  const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === "string") : typeof rawTags === "string" ? rawTags.split(/[,，]/) : [];
  return skillMetadataSchema.parse({
    name: typeof metadata.name === "string" && metadata.name.trim() ? metadata.name : body.match(/^#\s+(.+)$/m)?.[1]?.trim() || "未命名 Skill",
    description: typeof metadata.description === "string" ? metadata.description : "",
    tags: tags.map((tag) => tag.trim()).filter(Boolean), notes: "", favorite: false,
  });
}

export async function prepareSkillPackage(uploads: File[], paths?: string[]) {
  if (!uploads.length) throw new SkillInputError("请选择 SKILL.md、技能文件夹或 ZIP 文件。");
  if (uploads.length > MAX_SKILL_FILES) throw new SkillInputError(`每个技能包最多包含 ${MAX_SKILL_FILES} 个文件。`);
  if (paths && (paths.length !== uploads.length || paths.some((path) => typeof path !== "string"))) throw new SkillInputError("文件路径信息无效，请重新选择文件。");
  if (uploads.reduce((sum, file) => sum + file.size, 0) > MAX_SKILL_BYTES) throw new SkillInputError("上传文件的总大小不能超过 3 MB。", 413);
  const isZip = uploads.length === 1 && /\.zip$/i.test(uploads[0].name);
  const files: PackageFile[] = isZip ? await unpackZip(Buffer.from(await uploads[0].arrayBuffer())) : await Promise.all(uploads.map(async (file, index) => ({
    path: paths?.[index] ?? file.name, data: Buffer.from(await file.arrayBuffer()),
  })));
  const usable = files.filter((file) => { validatePath(file.path); return !ignored(file.path); });
  const candidates = usable.filter((file) => /(^|\/)SKILL\.md$/i.test(file.path)).sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  if (!candidates.length) throw new SkillInputError("没有找到 SKILL.md，请上传包含该文件的技能文件夹或 ZIP。");
  const skill = candidates[0];
  if (candidates[1] && candidates[1].path.split("/").length === skill.path.split("/").length) throw new SkillInputError("检测到多个 Skill，请每次上传一个技能包。");
  const prefix = skill.path.slice(0, skill.path.lastIndexOf("/") + 1);
  if (usable.some((file) => !file.path.startsWith(prefix))) throw new SkillInputError("请单独上传一个技能文件夹，所有文件应位于 SKILL.md 所在目录内。");
  let content: string;
  try { content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(skill.data); }
  catch { throw new SkillInputError("SKILL.md 必须使用 UTF-8 编码。"); }
  const metadata = parseSkillMarkdown(content);
  const folder = metadata.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "") || "skill";
  const archive = new JSZip();
  const seen = new Set<string>();
  const manifest = usable.map((file) => {
    const relative = file === skill ? "SKILL.md" : file.path.slice(prefix.length);
    if (seen.has(relative)) throw new SkillInputError("技能包中存在重复文件路径。");
    seen.add(relative);
    archive.file(`${folder}/${relative}`, file.data, { unixPermissions: file.unixPermissions });
    return { path: relative, size: file.data.length };
  }).sort((a, b) => a.path === "SKILL.md" ? -1 : b.path === "SKILL.md" ? 1 : a.path.localeCompare(b.path));
  return {
    ...metadata, content, files: manifest, totalBytes: manifest.reduce((sum, file) => sum + file.size, 0),
    sourceName: isZip ? uploads[0].name : prefix ? prefix.split("/").filter(Boolean).at(-1)! : uploads[0].name,
    archiveName: `${folder}.zip`, archiveBase64: await archive.generateAsync({ type: "base64", compression: "DEFLATE", platform: "UNIX" }),
  };
}

export async function readSkillUpload(request: Request) {
  const maxRequestBytes = MAX_SKILL_BYTES + 256 * 1024;
  if (Number(request.headers.get("content-length")) > maxRequestBytes) throw new SkillInputError("上传文件的总大小不能超过 3 MB。", 413);
  if (!request.body) throw new SkillInputError("上传内容为空。");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) { await reader.cancel(); throw new SkillInputError("上传文件的总大小不能超过 3 MB。", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new SkillInputError("上传格式无效，请重新选择文件。"); }
  const entries = form.getAll("files");
  if (entries.some((entry) => !(entry instanceof File))) throw new SkillInputError("上传格式无效。");
  let paths: string[] | undefined;
  if (form.has("paths")) {
    try { paths = JSON.parse(String(form.get("paths"))); if (!Array.isArray(paths)) throw new Error(); }
    catch { throw new SkillInputError("文件路径信息无效。"); }
  }
  return prepareSkillPackage(entries as File[], paths);
}
