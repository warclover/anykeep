/**
 * 规则设置页面
 *
 * 合并分类管理 + 工作流为统一的规则设置界面：
 * - Tab 1: 分类规则（智能分类、自定义规则、文件夹映射）
 * - Tab 2: 自动化流程（快捷模板、自定义工作流）
 * - Tab 3: 配置与历史（权重配置、执行历史）
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RulesPageClient } from "@/components/rules/rules-page-client";

export const metadata = {
  title: "规则设置 | AnyKeep",
  description: "管理分类规则、自动化流程和系统配置",
};

/**
 * 加载骨架屏
 */
function RulesPageSkeleton() {
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

      {/* Tab 骨架 */}
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
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
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<RulesPageSkeleton />}>
      <RulesPageClient />
    </Suspense>
  );
}
