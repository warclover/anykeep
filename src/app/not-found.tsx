/**
 * 404 错误页面
 * 当用户访问不存在的页面时显示
 */

import Link from "next/link";
import { RootProviders } from "@/components/providers/root-providers";
import { COLOR_THEME_INIT_SCRIPT } from "@/hooks/core";
import "./globals.css";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <RootProviders>
          <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="text-center">
              <h1 className="mb-4 text-6xl font-bold">404</h1>
              <h2 className="mb-6 text-2xl font-semibold">页面未找到</h2>
              <p className="mb-8 text-muted-foreground">
                抱歉，您访问的页面不存在
              </p>
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                返回首页
              </Link>
            </div>
          </div>
        </RootProviders>
      </body>
    </html>
  );
}
