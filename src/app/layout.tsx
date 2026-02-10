import type { Metadata } from "next";
import { RootProviders } from "@/components/providers/root-providers";
import "./globals.css";

/**
 * 颜色主题预加载脚本（纯字符串常量）
 * ⚠️ 必须定义在服务端组件文件中，不能从 "use client" 模块导入
 * 否则 SSR/CSR webpack 打包差异导致 dangerouslySetInnerHTML 不匹配 → hydration 崩溃
 *
 * 注意：此处的有效主题列表必须与 use-color-theme.ts 中的 VALID_THEMES 保持同步
 */
const COLOR_THEME_INIT_SCRIPT = `
(function() {
  try {
    var theme = localStorage.getItem('anykeep-color-theme');
    if (theme && ['blue', 'purple', 'orange', 'pink'].includes(theme)) {
      document.documentElement.setAttribute('data-color-theme', theme);
    } else {
      document.documentElement.setAttribute('data-color-theme', 'blue');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-color-theme', 'blue');
  }
})();
`;

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
