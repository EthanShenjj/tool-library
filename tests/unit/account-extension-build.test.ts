import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import vm from "node:vm";
import { recognizePlatform } from "@/lib/account-platform";
import { describe, expect, it } from "vitest";

describe("Chrome extension delivery", () => {
  it("ships a complete, self-contained MV3 package with narrowly scoped permissions", async () => {
    execFileSync(process.execPath, ["scripts/build-account-extension.mjs"]);
    const archive = await JSZip.loadAsync(readFileSync("public/downloads/account-manager-chrome-extension.zip"));
    const manifest = JSON.parse(await archive.file("manifest.json")!.async("string"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe("1.2.0");
    const context = vm.createContext({ URL });
    vm.runInContext(await archive.file("platforms.js")!.async("string"), context);
    for (const url of ["https://github.com/login", "https://creator.xiaohongshu.com", "https://business.facebook.com", "https://unknown.example"]) {
      expect(context.AccountPlatforms.recognizePlatform(url)).toEqual(recognizePlatform(url));
    }
    expect(manifest.permissions).toEqual(["activeTab", "scripting"]);
    expect(manifest.host_permissions).toEqual(["https://team-toolbox.vercel.app/*"]);
    expect(manifest).not.toHaveProperty("externally_connectable");
    expect(manifest).not.toHaveProperty("web_accessible_resources");
    const required = [manifest.action.default_popup, manifest.background.service_worker, "popup.css", "popup.js", ...manifest.content_scripts[0].js, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
    for (const name of required) expect(archive.file(name as string), name as string).not.toBeNull();
    expect(Object.keys(archive.files).some((name) => /\.env|token|credential|node_modules|\.vercel/.test(name))).toBe(false);
    expect((await archive.file("icons/key-128.png")!.async("nodebuffer")).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});
