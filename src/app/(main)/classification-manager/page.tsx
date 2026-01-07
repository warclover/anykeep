/**
 * 分类管理页面
 *
 * 提供智能分类系统的管理界面：
 * - 分类规则查看和配置
 * - 分类历史记录
 * - 权重调整
 * - 分类统计分析
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassificationManagerClient } from "@/components/classification-manager/classification-manager-client";

export const metadata = {
  title: "分类管理 | AnyKeep",
  description: "管理智能分类规则、查看分类历史、调整分类权重",
};

/**
 * 加载骨架屏
 */
function ClassificationManagerSkeleton() {
  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
      {/* 标题区域骨架 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 border rounded-xl space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* 主内容区骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="border rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
        <div className="lg:col-span-4 space-y-6">
          <div className="border rounded-xl p-6 space-y-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClassificationManagerPage() {
  return (
    <Suspense fallback={<ClassificationManagerSkeleton />}>
      <ClassificationManagerClient />
    </Suspense>
  );
}
