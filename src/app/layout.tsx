import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RootProviders } from "@/components/providers/root-providers";
import { COLOR_THEME_INIT_SCRIPT } from "@/hooks/use-color-theme";
import "./globals.css";

// 强制动态渲染以避免预渲染时的 Context 问题
// 子布局和页面会继承此配置
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
      <head>
        {/* 防闪烁：在 React 水合前设置颜色主题 */}
        <script dangerouslySetInnerHTML={{ __html: COLOR_THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
