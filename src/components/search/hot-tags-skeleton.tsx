/**
 * 热门标签骨架屏组件 - 用于 Suspense fallback
 */

import { Skeleton } from "@/components/ui/skeleton";

export function HotTagsSkeleton() {
  return (
    <div className="mb-8">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        🔥 热门标签
      </h3>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
    </div>
  );
}
