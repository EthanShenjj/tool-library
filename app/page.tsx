import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { discoverTools } from "@/lib/tools/discover";

export const dynamic = "force-static";

export default function DashboardPage() {
  const tools = discoverTools();
  const readyCount = tools.filter((tool) => tool.configured).length;
  const categoryCount = new Set(tools.map((tool) => tool.category)).size;

  return (
    <main className="mx-auto max-w-[1320px] px-5 pb-20 pt-10 lg:px-8 lg:pt-16">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="mb-6 flex items-center gap-3 text-sm font-semibold text-[#637064]">
            <span className="h-px w-10 bg-[#3156d8]" />
            工具目录已与当前工作区同步
          </div>
          <h1>把零散的小工具，<br />收进一个安静的工作台。</h1>
          <p>从一个入口找到、配置并使用团队内部工具。目录中的项目会在构建时自动登记，不再依赖口口相传的地址。</p>
        </div>
        <aside className="catalog-status">
          <div className="catalog-status-mark">CATALOG / {new Date().getFullYear()}</div>
          <dl>
            <div><dt>发现项目</dt><dd>{String(tools.length).padStart(2, "0")}</dd></div>
            <div><dt>已接入</dt><dd>{String(readyCount).padStart(2, "0")}</dd></div>
            <div><dt>工具分类</dt><dd>{String(categoryCount).padStart(2, "0")}</dd></div>
          </dl>
          <p>重新部署后更新目录索引</p>
        </aside>
      </section>
      <section className="mt-12 lg:mt-16" aria-labelledby="tool-catalog-title">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><h2 id="tool-catalog-title" className="text-2xl font-bold tracking-[-0.03em] text-[#18212f]">工具目录</h2><p className="mt-1 text-sm text-[#6d796c]">打开工具，或查看尚待接入的目录项目。</p></div>
          <span className="hidden text-xs font-bold text-[#7b8679] sm:block">{tools.length} 个项目</span>
        </div>
        <DashboardClient tools={tools} />
      </section>
    </main>
  );
}
