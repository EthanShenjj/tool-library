import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const excluded = new Set(["app", "components", "lib", "node_modules", "public", "scripts", "tests", "drizzle"]);

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { return null; }
}

const candidates = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !excluded.has(entry.name))
  .flatMap((entry) => {
    const directory = join(root, entry.name);
    const manifestPath = join(directory, "tool.config.json");
    const packagePath = join(directory, "package.json");
    if (!existsSync(manifestPath) && !existsSync(packagePath)) return [];
    const packageJson = existsSync(packagePath) ? readJson(packagePath) : null;
    return [{
      directory: entry.name,
      manifest: existsSync(manifestPath) ? readJson(manifestPath) : null,
      package: packageJson ? { name: packageJson.name, description: packageJson.description } : null,
    }];
  })
  .sort((a, b) => a.directory.localeCompare(b.directory));

writeFileSync(join(root, "lib/tools/generated.json"), `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
console.log(`Generated tool registry with ${candidates.length} project(s).`);
