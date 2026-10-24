import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, LockKeyhole, MonitorSmartphone } from "lucide-react";

export const metadata = {
  title: "图章 · 批量水印",
  description: "批量为商品图添加文字与 Logo 水印，所有图片均在本机处理。",
};

export default function ImageWatermarkPage() {
  return (
    <main className="mx-auto max-w-[1560px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-label="工具导航">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#59645d] hover:text-[#18212f]">
          <ArrowLeft className="size-4" />返回工具目录
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href="/downloads/image-watermark.html"
            download="图章-批量水印.html"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cfd5cd] bg-white px-4 text-sm font-bold text-[#253027] hover:border-[#aeb8ac]"
          >
            <Download className="size-4" />下载离线版
          </a>
          <a
            href="/downloads/image-watermark.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#18212f] px-4 text-sm font-bold text-white hover:bg-[#263243]"
          >
            <ExternalLink className="size-4" />在新窗口打开
          </a>
        </div>
      </nav>

      <section className="mb-4 grid gap-px overflow-hidden rounded-xl border border-[#d9ded7] bg-[#d9ded7] md:grid-cols-2">
        <div className="flex items-start gap-3 bg-white p-4">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-[#d44c2f]" />
          <div><h1 className="font-bold text-[#18212f]">图片只在当前设备处理</h1><p className="mt-1 text-sm leading-6 text-[#677168]">工具不会上传图片。关闭页面后，本次导入内容随即释放。</p></div>
        </div>
        <div className="flex items-start gap-3 bg-white p-4">
          <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-[#3156d8]" />
          <div><h2 className="font-bold text-[#18212f]">鸿蒙设备建议使用当前在线版</h2><p className="mt-1 text-sm leading-6 text-[#677168]">若 ZIP 保存受浏览器限制，可在图片列表中逐张保存。</p></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#cfd5cd] bg-[#e9ece7] shadow-[0_18px_60px_rgba(24,33,47,0.12)]">
        <iframe
          title="图章批量水印编辑器"
          src="/downloads/image-watermark.html"
          className="block h-[calc(100vh-150px)] min-h-[760px] w-full border-0"
          allow="clipboard-write"
        />
      </section>
    </main>
  );
}
