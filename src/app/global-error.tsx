"use client";

import { useEffect } from "react";

/**
 * 全局错误处理组件
 * 当根布局或其他顶级错误发生时显示
 * 必须是客户端组件，且必须包含完整的 html/body 结构
 *
 * 注意：Sentry 错误上报已禁用
 * 原因：@sentry/nextjs 的动态导入仍会导致 @sentry/node 和 @opentelemetry
 *       服务端代码被打包到客户端 bundle，引发 hydration 错误
 * 解决方案：使用单独的 Sentry 客户端配置（sentry.client.config.ts）处理错误上报
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 仅记录到控制台，Sentry 上报由 sentry.client.config.ts 全局配置处理
    console.error("[GlobalError]", error.message, error.digest);
  }, [error]);
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">出错了</h1>
          <p className="text-gray-600 mb-6">
            应用程序遇到了一个错误，请稍后重试
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
