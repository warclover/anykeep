/**
 * 数据中心骨架屏组件
 * 用于页面加载时显示占位内容
 */

import { Skeleton } from "@/components/ui/skeleton";

export function DataHubSkeleton() {
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* 标题骨架 */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Tab 骨架 */}
      <DataHubTabSkeleton />
    </div>
  );
}

export function DataHubTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Tab 列表骨架 */}
      <div className="grid w-full grid-cols-3 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>

      {/* Tab 内容骨架 */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
