"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Box, ImageIcon, KeyRound, Search, Sheet, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { DiscoveredTool } from "@/lib/tools/schema";
import { cn } from "@/lib/utils";

const iconMap = { sheet: Sheet, box: Box, wrench: Wrench, image: ImageIcon, key: KeyRound };
const statusMap = {
  ready: { label: "可用", variant: "green" as const },
  beta: { label: "测试中", variant: "blue" as const },
  maintenance: { label: "待接入", variant: "amber" as const },
};

export function DashboardClient({ tools }: { tools: DiscoveredTool[] }) {
  const categories = ["全部", ...Array.from(new Set(tools.map((tool) => tool.category)))];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const visibleTools = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tools.filter((tool) =>
      (category === "全部" || tool.category === category) &&
      (!keyword || `${tool.name} ${tool.description} ${tool.directory}`.toLowerCase().includes(keyword)),
    );
  }, [category, query, tools]);

  return (
    <>
      <div className="catalog-controls">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#798578]" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工具或目录" className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-[#dce1da] bg-white p-1" aria-label="工具分类">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={cn("rounded-lg px-3 py-2 text-xs font-semibold text-[#667266] transition-colors", category === item && "bg-[#18212f] text-white")}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {visibleTools.length ? (
        <div className="tool-grid">
          {visibleTools.map((tool, index) => {
            const Icon = iconMap[tool.icon as keyof typeof iconMap] || Wrench;
            const status = statusMap[tool.status];
            const content = (
              <article className={cn("tool-card", !tool.configured && "tool-card-disabled")}>
                <div className="tool-card-spine"><span>{String(index + 1).padStart(2, "0")}</span></div>
                <div className="tool-card-body">
                  <div className="flex items-start justify-between gap-3">
                    <div className="tool-icon"><Icon className="size-6" /></div>
                    <Badge variant={status.variant}><span className="size-1.5 rounded-full bg-current" />{status.label}</Badge>
                  </div>
                  <h2 className="mt-7 text-xl font-bold tracking-[-0.02em] text-[#18212f]">{tool.name}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-[#657164]">{tool.description}</p>
                  <div className="mt-7 flex items-center justify-between border-t border-[#e4e8e1] pt-4">
                    <span className="text-xs font-semibold text-[#7a8679]">{tool.category} / {tool.directory}</span>
                    <span className="flex items-center gap-1 text-sm font-bold text-[#3156d8]">
                      {tool.configured ? "打开工具" : "等待配置"}
                      {tool.configured && <ArrowUpRight className="size-4" />}
                    </span>
                  </div>
                </div>
              </article>
            );
            if (!tool.configured) return <div key={tool.id}>{content}</div>;
            return tool.entry.type === "external" ? (
              <a key={tool.id} href={tool.entry.url} target="_blank" rel="noreferrer" className="focus-ring">{content}</a>
            ) : (
              <Link key={tool.id} href={tool.entry.href} className="focus-ring">{content}</Link>
            );
          })}
        </div>
      ) : (
        <div className="empty-panel"><Search className="size-6" /><h2>没有匹配的工具</h2><p>换一个关键词，或切换到其他分类。</p></div>
      )}
    </>
  );
}
