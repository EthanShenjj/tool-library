import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center"><div><p className="text-7xl font-bold tracking-[-.08em] text-[#3156d8]">404</p><h1 className="mt-4 text-2xl font-bold">这里没有工具</h1><p className="mt-2 text-sm text-[#6d796c]">页面可能已移动，或连接器已经被删除。</p><Button asChild className="mt-6" variant="primary"><Link href="/">返回工具目录</Link></Button></div></main>;
}
