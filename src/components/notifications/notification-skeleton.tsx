/**
 * 通知卡片骨架屏
 * @description 加载状态占位组件
 */

import { Skeleton } from "@/components/ui/skeleton";

export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-border/50">
      {/* 左侧指示条 */}
      <div className="w-1 h-12 rounded-full bg-muted" />

      {/* 图标 */}
      <Skeleton className="size-8 rounded-full shrink-0" />

      {/* 内容区 */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      {/* 时间 */}
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border/50">
      {/* 分组标题骨架 */}
      <div className="px-4 py-2 bg-muted/30">
        <Skeleton className="h-4 w-16" />
      </div>

      {/* 通知卡片骨架 */}
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeleton key={i} />
      ))}
    </div>
  );
}
