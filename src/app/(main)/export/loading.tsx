/**
 * 数据导出页面 - 加载状态
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function ExportLoading() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* 格式选择 */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>

      {/* 筛选条件 */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* 导出预览 */}
      <Skeleton className="h-32 w-full" />

      {/* 导出按钮 */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
