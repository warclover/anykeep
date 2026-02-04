import type { Metadata } from "next";
import { RootProviders } from "@/components/providers/root-providers";
import { COLOR_THEME_INIT_SCRIPT } from "@/hooks/core";
import "./globals.css";

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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: COLOR_THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
