import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import { Toaster } from "sonner";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: { default: "团队工具台", template: "%s · 团队工具台" },
  description: "团队内部工具的统一入口与配置工作台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppHeader />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
