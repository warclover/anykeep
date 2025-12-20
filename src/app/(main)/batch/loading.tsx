/**
 * 批量操作页面加载骨架屏
 */

import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare } from "lucide-react";

export default function BatchLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* 页面头部骨架 */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-6 w-6 text-purple-500" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-9 w-24" />
      </header>

      {/* 筛选栏骨架 */}
      <div className="px-6 py-3 border-b bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-9 w-[140px]" />
          <Skeleton className="h-9 w-[140px]" />
        </div>
      </div>

      {/* 书签列表骨架 */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {/* 复选框 */}
              <Skeleton className="h-5 w-5 rounded" />
              {/* Favicon */}
              <Skeleton className="h-5 w-5 rounded" />
              {/* 标题 */}
              <Skeleton className="h-4 flex-1 max-w-md" />
              {/* 域名 */}
              <Skeleton className="h-4 w-24" />
              {/* 日期 */}
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* 底部状态栏骨架 */}
      <footer className="px-6 py-2 border-t bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </footer>
    </div>
  );
}
