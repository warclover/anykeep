/**
 * AI 能力中心页面
 *
 * 展示所有可用的 AI Skills，按分类组织
 * 用户可以浏览、搜索和使用各种 AI 能力
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AIHubClient } from "@/components/ai-hub/ai-hub-client";

export const metadata = {
  title: "AI 能力中心 | AnyKeep",
  description:
    "探索和使用 AnyKeep 的 25+ AI 能力，智能搜索、摘要、整理、学习助手等",
};

/**
 * 加载骨架屏
 */
function AIHubSkeleton() {
  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
      {/* 标题区域骨架 */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 border rounded-xl space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Skills 列表骨架 */}
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="p-4 border rounded-xl space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIHubPage() {
  return (
    <Suspense fallback={<AIHubSkeleton />}>
      <AIHubClient />
    </Suspense>
  );
}
