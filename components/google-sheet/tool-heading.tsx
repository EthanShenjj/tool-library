import Link from "next/link";
import { ChevronRight, Sheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ToolHeading({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <>
      <nav className="workspace-nav" aria-label="面包屑">
        <Link href="/">工具目录</Link><ChevronRight className="size-3.5" /><Link href="/tools/google-sheet">Google Sheet</Link>
      </nav>
      <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[13px] bg-[#dff5e9] text-[#17623d]"><Sheet className="size-5" /></span><Badge variant="green">只读连接</Badge></div>
          <h1 className="workspace-title">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#667366]">{description}</p>
        </div>
        {children && <div className="flex shrink-0 gap-2">{children}</div>}
      </div>
    </>
  );
}
