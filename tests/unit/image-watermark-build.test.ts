import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("image watermark offline build", () => {
  it("ships as one self-contained HTML file", async () => {
    const publicBuild = await readFile(resolve("public/downloads/image-watermark.html"), "utf8");
    const distributable = await readFile(resolve("image-watermark/dist/image-watermark.html"), "utf8");
    const sourcePreview = await readFile(resolve("image-watermark/src/index.html"), "utf8");

    expect(publicBuild).toBe(distributable);
    expect(sourcePreview).toBe(publicBuild);
    expect(publicBuild).toContain("商品图批量水印");
    expect(publicBuild).toContain("JSZip");
    expect(publicBuild).not.toContain("data-dev-only");
    expect(publicBuild).not.toMatch(/<script[^>]+src=/i);
    expect(publicBuild).not.toMatch(/<link[^>]+href=/i);
    expect(Buffer.byteLength(publicBuild)).toBeLessThan(500_000);
  });
});
