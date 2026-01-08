/**
 * 学习助手页面
 *
 * 聚合学习相关的 AI Skills，提供：
 * - 学习统计概览
 * - 快捷操作卡片
 * - 学习历程记录
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LearningHubClient } from "@/components/learning-hub/learning-hub-client";

export const metadata: Metadata = {
  title: "学习助手 - AnyKeep",
  description: "AI 驱动的学习管理，规划学习路径、制定阅读计划、生成学习报告",
};

function LoadingSkeleton() {
  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-6xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function LearningHubPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <LearningHubClient />
    </Suspense>
  );
}
