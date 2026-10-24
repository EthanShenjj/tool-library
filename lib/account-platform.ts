export const platformCategories = {
  social: "社交内容",
  collaboration: "办公协作",
  development: "开发工具",
  ai: "AI 工具",
  cloud: "云服务",
  marketing: "营销分析",
  commerce: "电商购物",
  design: "设计创作",
  uncategorized: "未分类",
} as const;

export type PlatformCategory = keyof typeof platformCategories;
export type PlatformRecognition = {
  name: string;
  hostname: string;
  category: PlatformCategory;
  categoryLabel: string;
  recognized: boolean;
};

type PlatformRule = { name: string; category: PlatformCategory; domains: readonly string[] };

// Match host boundaries only. A more specific product host wins over its parent.
const rules: readonly PlatformRule[] = [
  { name: "GitHub", category: "development", domains: ["github.com"] },
  { name: "GitLab", category: "development", domains: ["gitlab.com"] },
  { name: "Stack Overflow", category: "development", domains: ["stackoverflow.com"] },
  { name: "npm", category: "development", domains: ["npmjs.com"] },
  { name: "Vercel", category: "cloud", domains: ["vercel.com"] },
  { name: "Netlify", category: "cloud", domains: ["netlify.com"] },
  { name: "Cloudflare", category: "cloud", domains: ["cloudflare.com"] },
  { name: "AWS", category: "cloud", domains: ["aws.amazon.com"] },
  { name: "阿里云", category: "cloud", domains: ["aliyun.com"] },
  { name: "腾讯云", category: "cloud", domains: ["cloud.tencent.com"] },
  { name: "ChatGPT", category: "ai", domains: ["chatgpt.com", "chat.openai.com"] },
  { name: "OpenAI", category: "ai", domains: ["openai.com"] },
  { name: "Claude", category: "ai", domains: ["claude.ai"] },
  { name: "DeepSeek", category: "ai", domains: ["deepseek.com"] },
  { name: "豆包", category: "ai", domains: ["doubao.com"] },
  { name: "飞书", category: "collaboration", domains: ["feishu.cn"] },
  { name: "Lark", category: "collaboration", domains: ["larksuite.com"] },
  { name: "Notion", category: "collaboration", domains: ["notion.so"] },
  { name: "Slack", category: "collaboration", domains: ["slack.com"] },
  { name: "Discord", category: "collaboration", domains: ["discord.com"] },
  { name: "钉钉", category: "collaboration", domains: ["dingtalk.com"] },
  { name: "企业微信", category: "collaboration", domains: ["work.weixin.qq.com"] },
  { name: "Google 文档", category: "collaboration", domains: ["docs.google.com"] },
  { name: "Google 云端硬盘", category: "collaboration", domains: ["drive.google.com"] },
  { name: "Gmail", category: "collaboration", domains: ["mail.google.com"] },
  { name: "小红书", category: "social", domains: ["xiaohongshu.com", "xhslink.com"] },
  { name: "抖音", category: "social", domains: ["douyin.com"] },
  { name: "TikTok", category: "social", domains: ["tiktok.com"] },
  { name: "哔哩哔哩", category: "social", domains: ["bilibili.com", "b23.tv"] },
  { name: "微博", category: "social", domains: ["weibo.com", "weibo.cn"] },
  { name: "微信公众号", category: "social", domains: ["mp.weixin.qq.com"] },
  { name: "知乎", category: "social", domains: ["zhihu.com"] },
  { name: "YouTube", category: "social", domains: ["youtube.com", "youtu.be"] },
  { name: "Instagram", category: "social", domains: ["instagram.com"] },
  { name: "Facebook", category: "social", domains: ["facebook.com"] },
  { name: "X", category: "social", domains: ["x.com", "twitter.com"] },
  { name: "Google Ads", category: "marketing", domains: ["ads.google.com"] },
  { name: "Google Analytics", category: "marketing", domains: ["analytics.google.com"] },
  { name: "Meta 商务管理", category: "marketing", domains: ["business.facebook.com", "adsmanager.facebook.com"] },
  { name: "巨量引擎", category: "marketing", domains: ["oceanengine.com"] },
  { name: "Amplitude", category: "marketing", domains: ["amplitude.com"] },
  { name: "Mixpanel", category: "marketing", domains: ["mixpanel.com"] },
  { name: "淘宝", category: "commerce", domains: ["taobao.com"] },
  { name: "天猫", category: "commerce", domains: ["tmall.com"] },
  { name: "京东", category: "commerce", domains: ["jd.com"] },
  { name: "Amazon", category: "commerce", domains: ["amazon.com"] },
  { name: "Shopify", category: "commerce", domains: ["shopify.com"] },
  { name: "Figma", category: "design", domains: ["figma.com"] },
  { name: "Canva", category: "design", domains: ["canva.com", "canva.cn"] },
  { name: "Adobe", category: "design", domains: ["adobe.com"] },
];

export function recognizePlatform(value: string): PlatformRecognition {
  let hostname = "";
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) {
      hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
    }
  } catch { /* Leave malformed and restricted URLs unclassified. */ }
  let best: PlatformRule | undefined;
  let specificity = 0;
  if (hostname) for (const rule of rules) {
    for (const domain of rule.domains) {
      if ((hostname === domain || hostname.endsWith(`.${domain}`)) && domain.length > specificity) {
        best = rule;
        specificity = domain.length;
      }
    }
  }
  const category = best?.category ?? "uncategorized";
  return { name: best?.name ?? hostname.slice(0, 100), hostname, category, categoryLabel: platformCategories[category], recognized: Boolean(best) };
}
