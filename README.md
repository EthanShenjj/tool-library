# 团队工具台

一个面向团队内部使用的 Next.js 工具目录。首页在构建时发现当前仓库中的一级项目目录；Google Sheet 是首个原生工具，支持共享 Service Account / OAuth、表格预览、字段映射和连接器配置管理。

> 当前版本只保存同步计划参数，不执行后台同步任务。

账号管理位于 `/tools/account-manager`，支持保存平台名称、网站 URL、账号、密码和备注，以及搜索、平台筛选、编辑、复制和删除。账号、密码和备注使用 AES-256-GCM 加密后保存到 PostgreSQL；列表不返回密码，主动查看时才读取，30 秒后或切换浏览器标签时隐藏。编辑时密码留空会保留原密码，也可选择移除密码。

账号、密码可以留空，只保存网站地址。账号管理页面提供 Chrome 快速保存插件下载与安装说明：解压 ZIP 后，通过 `chrome://extensions` 的开发者模式加载。插件自动带入当前网页 URL，复用同一 Chrome 中的工具台登录状态，通过后台工具台标签页保存。遇到同域名、同账号记录时，可选择更新或另存；更新时空密码、空备注保留原内容。插件保存成功会通知工具页刷新列表，网站重新获得焦点时也会刷新，不影响搜索条件和正在编辑的草稿。

插件源码在 `account-manager/extension/`。执行 `npm run build:extension` 生成下载 ZIP 及 `.vercel/account-manager-extension/` 开发加载目录；开发与生产构建会自动打包。插件仅申请 `activeTab`、脚本执行和固定工具台域名权限，不读取网站密码，不保存本地密码，不提供密码读取或删除接口，也不改变网站的访问保护与同源校验。

启用账号管理需配置下方的 `DATABASE_URL`、`CREDENTIALS_ENCRYPTION_KEY`，再执行 `npm run db:migrate` 创建账号表。加密密钥需要持久保存，已有数据无法在丢失密钥后恢复。账号由工作区成员共享访问，部署时沿用下方的 Vercel 团队访问保护。

## 本地启动

Skill Hub 位于 `/tools/skill-hub`，用于上传和沉淀常用 Skill。支持单个 `SKILL.md`、完整技能文件夹或 ZIP，自动解析 YAML 名称、说明和标签；可搜索、按标签筛选、收藏、编辑说明与备注、复制 `SKILL.md`、下载完整 ZIP 和删除。详情中的「更新技能包」可替换原始文件，同时保留已整理的信息。

本地运行时不需要配置数据库，即可上传和管理 Skill：未设置 `DATABASE_URL` 时自动使用项目中的 `.data/skill-hub.sqlite` 保存，刷新页面、重启服务后数据仍保留（需要 Node.js 22.16 或更新版本）。`.data/` 已排除在 Git 之外，备份时请保留该文件。

配置 `DATABASE_URL` 后沿用 PostgreSQL 数据库，需执行 `npm run db:migrate` 创建 `saved_skills` 表；本地 SQLite 和 PostgreSQL 是两个独立技能库，不自动迁移。Vercel 部署使用 PostgreSQL，由可访问工具台的成员共享。上传及解压后均限制为 3 MB、200 个文件，`SKILL.md` 最大 256 KB。下载包保留脚本、附件、参考文件和可执行权限；上传时忽略 `.git`、`node_modules`、`.venv` 和 macOS 元数据。Skill Hub 只管理文件，不执行技能脚本。

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

生成 32 字节加密密钥：

```bash
openssl rand -hex 32
```

必要环境变量：

- `DATABASE_URL`：Neon 或其他 PostgreSQL 的 pooled connection string。
- `CREDENTIALS_ENCRYPTION_KEY`：64 位十六进制密钥；修改后旧凭据将无法解密。
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`：Google OAuth Web Client。
- `APP_URL`：应用完整来源，例如 `https://tools.example.com`。

Google OAuth 回调地址为 `${APP_URL}/api/google/oauth/callback`。Sheets API 与 Drive API 均需启用。

## 工具目录协议

构建时会扫描一级目录中包含 `tool.config.json` 或 `package.json` 的项目。有效 Manifest 会生成可用卡片；只有 `package.json` 或 Manifest 无效时显示“待接入”。

```json
{
  "id": "example-tool",
  "name": "Example Tool",
  "description": "清晰说明工具的用途。",
  "category": "数据连接",
  "icon": "box",
  "status": "ready",
  "entry": { "type": "internal", "href": "/tools/example" }
}
```

`entry` 也可使用 `{ "type": "external", "url": "https://..." }`。新增项目后需重新部署，Dashboard 才会更新索引。

## Vercel 部署

1. 将本目录作为独立 Git 仓库推送，并把它设为 Vercel Root Directory。
2. 在 Vercel Marketplace 创建 Neon Postgres，注入 `DATABASE_URL`。
3. 配置生产、预览环境变量；预览环境建议使用独立 Google OAuth Client。
4. 执行 `npm run db:migrate`。
5. 在 Deployment Protection 中启用 Vercel Authentication，并将范围设为 **All Deployments**。
6. 更新 Google OAuth 正式回调 URI 后部署。

不要把 `.env*`、Service Account JSON 或 OAuth Token 提交到 Git。仓库中旧版 Google Sheet 原型曾包含真实凭据痕迹；上线前必须在 Google Cloud 中轮换 OAuth Client Secret 和 Service Account 私钥，并撤销旧 OAuth Token。

## 验证

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
