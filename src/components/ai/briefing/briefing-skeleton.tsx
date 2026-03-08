/**
 * 主动简报骨架屏组件
 *
 * 在简报数据加载时显示占位内容
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface BriefingSkeletonProps {
  className?: string;
}

/**
 * 主动简报骨架屏
 */
export const BriefingSkeleton = memo(function BriefingSkeleton({
  className,
}: BriefingSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-purple-100 bg-white p-4 shadow-sm",
        className,
      )}
    >
      {/* 头部骨架 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="size-8 rounded-md" />
      </div>

      {/* 摘要骨架 */}
      <div className="p-3 rounded-lg bg-gray-50 mb-4">
        <Skeleton className="h-4 w-full mb-1.5" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* 洞察列表骨架 */}
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-20" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-3 rounded-lg border border-gray-100 bg-gray-50"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="size-7 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 建议操作骨架 */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-2 rounded-lg border border-gray-100"
          >
            <Skeleton className="size-8 rounded-md" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="size-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
});

export default BriefingSkeleton;
