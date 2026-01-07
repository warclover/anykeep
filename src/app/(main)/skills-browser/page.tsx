/**
 * Skills 浏览器页面
 *
 * 展示所有可用的 AI Skills，按分类组织
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SkillsBrowserClient } from "@/components/skills-browser/skills-browser-client";

export const metadata = {
  title: "Skills 浏览器 | AnyKeep",
  description: "浏览和了解所有可用的 AI Skills",
};

/**
 * 加载骨架屏
 */
function SkillsBrowserSkeleton() {
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

export default function SkillsBrowserPage() {
  return (
    <Suspense fallback={<SkillsBrowserSkeleton />}>
      <SkillsBrowserClient />
    </Suspense>
  );
}
