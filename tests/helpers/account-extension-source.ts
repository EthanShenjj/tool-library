import { readFileSync } from "node:fs";
import ts from "typescript";

const recognition = ts.transpileModule(readFileSync("lib/account-platform.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
export const recognitionSource = `(() => { const exports = {}; ${recognition}\nglobalThis.AccountPlatforms = exports; })();`;
export const extensionCoreSource = `${recognitionSource}\n${readFileSync("account-manager/extension/shared.js", "utf8")}`;
