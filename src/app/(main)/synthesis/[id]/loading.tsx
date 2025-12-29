/**
 * 综述详情页加载状态
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function SynthesisDetailLoading() {
  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* 返回按钮和标题骨架 */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-64" />
      </div>

      {/* 元信息骨架 */}
      <div className="flex gap-3">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* 概述骨架 */}
      <div className="border rounded-lg p-6 space-y-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* 共识骨架 */}
      <div className="border rounded-lg p-6 space-y-3">
        <Skeleton className="h-6 w-28" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>

      {/* 分歧骨架 */}
      <div className="border rounded-lg p-6 space-y-3">
        <Skeleton className="h-6 w-28" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>

      {/* 盲区骨架 */}
      <div className="border rounded-lg p-6 space-y-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
