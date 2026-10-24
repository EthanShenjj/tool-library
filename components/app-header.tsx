import Link from "next/link";
import { Blocks, ShieldCheck } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#dce1da] bg-[#f4f6f2]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 lg:px-8">
        <Link href="/" className="group flex items-center gap-3 font-bold text-[#18212f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156d8]">
          <span className="grid size-9 place-items-center rounded-[11px] bg-[#18212f] text-white transition-transform group-hover:-rotate-3">
            <Blocks className="size-[18px]" />
          </span>
          <span>团队工具台</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#5e6b5d]">
          <ShieldCheck className="size-4 text-[#287b56]" />
          Vercel 团队保护
        </div>
      </div>
    </header>
  );
}
