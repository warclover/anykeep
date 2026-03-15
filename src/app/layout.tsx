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

/**
 * 阅读器主题预加载脚本
 * 在 React hydration 之前从 localStorage 读取用户偏好的阅读器主题，
 * 将 CSS 变量设置到 <html> 上，避免页面加载时的白→色闪烁。
 * 当路径为阅读器详情页时，注入内联 <style> 覆盖主布局背景色。
 *
 * 注意：主题色值必须与 theme-config.ts 中的 READER_THEMES 保持同步
 */
const READER_THEME_INIT_SCRIPT = `
(function() {
  var themes = {
    light:  { bg:'#ffffff', fg:'#1a1a1a', accent:'#2563eb', muted:'#f5f5f5', border:'#e5e5e5' },
    dark:   { bg:'#1a1a1a', fg:'#e5e5e5', accent:'#60a5fa', muted:'#2d2d2d', border:'#404040' },
    sepia:  { bg:'#f5f0e6', fg:'#5c4b37', accent:'#b45309', muted:'#ebe5d9', border:'#d9d0c0' },
    paper:  { bg:'#faf8f5', fg:'#3d3d3d', accent:'#6366f1', muted:'#f0ede8', border:'#e0ddd5' }
  };
  try {
    var saved = localStorage.getItem('md-reader-theme');
    var t = (saved && themes[saved]) ? themes[saved] : themes.light;
    var s = document.documentElement.style;
    s.setProperty('--reader-bg', t.bg);
    s.setProperty('--reader-fg', t.fg);
    s.setProperty('--reader-accent', t.accent);
    s.setProperty('--reader-muted', t.muted);
    s.setProperty('--reader-border', t.border);
    if (/^\\/md-collections\\/\\d+/.test(location.pathname)) {
      document.documentElement.setAttribute('data-reader-page', '');
      var st = document.createElement('style');
      st.id = 'reader-theme-preload';
      st.textContent =
        'html[data-reader-page] { background:' + t.bg + ' }' +
        'html[data-reader-page] body { background:' + t.bg + ' !important }' +
        '.main-layout-shell { background:' + t.bg + ' !important }' +
        '.reader-theme-container { background:' + t.bg + '; color:' + t.fg + ' }' +
        '.reader-content-area { background:' + t.bg + '; color:' + t.fg + ' }';
      document.head.appendChild(st);
    }
  } catch (e) {}
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
        <script
          dangerouslySetInnerHTML={{ __html: READER_THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="font-sans antialiased">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
