"use client";

import { useEffect } from "react";

/**
 * 全局错误处理组件
 * 当根布局或其他顶级错误发生时显示
 * 必须是客户端组件，且必须包含完整的 html/body 结构
 *
 * 注意：仅使用 console 与内联逻辑，避免依赖其他模块导致 global-error 自身加载失败（500）
 * Sentry 上报由 sentry.client.config.ts 全局配置处理
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[GlobalError] Global error occurred",
      error?.message,
      error?.digest,
    );
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
