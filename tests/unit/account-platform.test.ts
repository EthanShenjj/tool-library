import { describe, expect, it } from "vitest";
import { recognizePlatform } from "@/lib/account-platform";

describe("URL platform and purpose recognition", () => {
  it.each([
    ["https://www.XIAOHONGSHU.com/explore?q=keep#section", "小红书", "social"],
    ["https://creator.douyin.com/", "抖音", "social"],
    ["https://github.com/login", "GitHub", "development"],
    ["https://tenant.feishu.cn/wiki/example", "飞书", "collaboration"],
    ["https://chatgpt.com/", "ChatGPT", "ai"],
    ["https://chat.openai.com/", "ChatGPT", "ai"],
    ["https://platform.openai.com/", "OpenAI", "ai"],
    ["https://business.facebook.com/", "Meta 商务管理", "marketing"],
    ["https://facebook.com/", "Facebook", "social"],
    ["https://console.aws.amazon.com/", "AWS", "cloud"],
    ["https://amazon.com/", "Amazon", "commerce"],
    ["https://www.figma.com/", "Figma", "design"],
    ["https://github.com./", "GitHub", "development"],
  ])("recognizes %s", (url, name, category) => {
    expect(recognizePlatform(url)).toMatchObject({ name, category, recognized: true });
  });

  it.each([
    "https://github.com.evil.example/", "https://notgithub.com/", "https://evil.example/?url=https://github.com",
    "https://evil.example/github.com", "https://github.com@evil.example/", "https://gіthub.com/", "https://team.vercel.app/",
  ])("does not classify lookalikes, embedded names, or tenant sites: %s", (url) => {
    expect(recognizePlatform(url)).toMatchObject({ recognized: false, category: "uncategorized" });
  });

  it("keeps an unknown domain available as a suggested name", () => {
    expect(recognizePlatform("https://www.internal.example:8443/a")).toMatchObject({ name: "internal.example", categoryLabel: "未分类", recognized: false });
  });

  it.each(["", "bad url", "chrome://extensions", "javascript:alert(1)", "https://user:secret@github.com/"])("rejects invalid or credential-bearing URLs: %s", (url) => {
    expect(recognizePlatform(url)).toMatchObject({ name: "", hostname: "", category: "uncategorized", recognized: false });
  });
});
