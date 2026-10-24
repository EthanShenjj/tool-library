import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(currentDirectory, "..");
const workspaceDirectory = resolve(projectDirectory, "..");
const jszipPackage = require.resolve("jszip/package.json");

const [template, styles, application, jszip] = await Promise.all([
  readFile(join(projectDirectory, "src/template.html"), "utf8"),
  readFile(join(projectDirectory, "src/styles.css"), "utf8"),
  readFile(join(projectDirectory, "src/app.js"), "utf8"),
  readFile(join(dirname(jszipPackage), "dist/jszip.min.js"), "utf8"),
]);

const safeScript = (source) => source.replace(/<\/script/gi, "<\\/script");
const output = template
  .replace("/* __WATERMARK_STYLES__ */", () => styles.replace(/<\/style/gi, "<\\/style"))
  .replace("/* __JSZIP__ */", () => safeScript(jszip))
  .replace("/* __WATERMARK_APP__ */", () => safeScript(application));

const distDirectory = join(projectDirectory, "dist");
const publicDirectory = join(workspaceDirectory, "public/downloads");
await Promise.all([mkdir(distDirectory, { recursive: true }), mkdir(publicDirectory, { recursive: true })]);
await Promise.all([
  writeFile(join(distDirectory, "image-watermark.html"), output, "utf8"),
  writeFile(join(publicDirectory, "image-watermark.html"), output, "utf8"),
  writeFile(join(projectDirectory, "src/index.html"), output, "utf8"),
]);

console.log(`Built image-watermark.html (${Buffer.byteLength(output).toLocaleString()} bytes)`);
