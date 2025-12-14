"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * 全局错误处理组件
 * 当根布局或其他顶级错误发生时显示
 * 必须是客户端组件，且必须包含完整的 html/body 结构
 *
 * @integrated Sentry - 自动上报错误到 Sentry
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Report error to Sentry
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorType: "global",
        digest: error.digest,
      },
    });
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
