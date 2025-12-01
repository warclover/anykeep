import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RootProviders } from "@/components/providers/root-providers";
import "./globals.css";

// 标记为动态路由
export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AnyKeep - 跨平台智能内容聚合",
  description:
    "统一管理微信公众号、B站、小红书等平台的收藏内容，AI 智能标签与语义搜索",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AnyKeep",
  },
  icons: {
    icon: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
