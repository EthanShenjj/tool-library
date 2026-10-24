import { deflateSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import JSZip from "jszip";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "account-manager/extension");
const unpacked = join(root, ".vercel/account-manager-extension");
const downloads = join(root, "public/downloads");
const zip = new JSZip();
const files = ["manifest.json", "shared.js", "bridge.js", "service-worker.js", "popup.html", "popup.css", "popup.js", "README.md"];
const zipOptions = { date: new Date("2026-01-01T00:00:00Z") };

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, crc]);
}

// A small local key mark; no remote icon requests or image dependencies at build time.
function icon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * 32 / size;
      const py = (y + 0.5) * 32 / size;
      const inside = px >= 1 && px <= 31 && py >= 1 && py <= 31 && Math.hypot(Math.max(0, Math.abs(px - 16) - 9), Math.max(0, Math.abs(py - 16) - 9)) <= 6;
      const ring = Math.abs(Math.hypot(px - 11, py - 11) - 5) <= 1.3;
      const shaft = px >= 14 && px <= 26 && Math.abs(py - px) <= 1.5;
      const teeth = (px >= 19 && px <= 22 && py >= 15 && py <= 20) || (px >= 23 && px <= 26 && py >= 20 && py <= 24);
      const color = ring || shaft || teeth ? [255, 255, 255] : [49, 86, 216];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      pixels.set([...color, inside ? 255 : 0], offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}

await mkdir(join(unpacked, "icons"), { recursive: true });
await mkdir(downloads, { recursive: true });
const recognition = ts.transpileModule(await readFile(join(root, "lib/account-platform.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const platformBundle = `(() => { const exports = {}; ${recognition}\nglobalThis.AccountPlatforms = exports; })();`;
await writeFile(join(unpacked, "platforms.js"), platformBundle);
zip.file("platforms.js", platformBundle, zipOptions);
for (const name of files) {
  const data = await readFile(join(source, name));
  await writeFile(join(unpacked, name), data);
  zip.file(name, data, zipOptions);
}
for (const size of [16, 32, 48, 128]) {
  const name = `icons/key-${size}.png`;
  const data = icon(size);
  await writeFile(join(unpacked, name), data);
  zip.file(name, data, zipOptions);
}
const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
await writeFile(join(downloads, "account-manager-chrome-extension.zip"), archive);
const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
console.log(`Built Chrome extension v${manifest.version} (${archive.length.toLocaleString()} bytes).`);
