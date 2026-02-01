import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* 页面头部骨架 */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-background/95">
        <Skeleton className="h-7 w-16" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* 消息列表骨架 */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* 日期分组 */}
        {Array.from({ length: 2 }).map((_, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            {/* 日期标题 */}
            <Skeleton className="h-4 w-20" />

            {/* 消息项 */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-4 border rounded-lg bg-white dark:bg-gray-800 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Skeleton className="h-6 w-14 rounded" />
                  <Skeleton className="h-6 w-14 rounded" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
