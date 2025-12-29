/**
 * TanStack Query Provider
 *
 * 提供 React Query 上下文
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createQueryClient } from "./client";

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Query Provider 组件
 *
 * 使用 useState 确保客户端只创建一次 QueryClient
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // 使用 useState 确保 QueryClient 只在客户端创建一次
  // 这避免了服务端和客户端的 hydration 不匹配
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools 仅在开发环境显示 */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
}
