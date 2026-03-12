/**
 * Home V2 骨架屏
 * 纯 CSS 动画 + 最小 JS，零客户端组件依赖。
 * 复用旧版骨架屏布局结构。
 *
 * @since home-v2
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function HomeV2Loading() {
  return (
    <div className="flex flex-col h-full px-4 md:px-8 py-0.5 md:py-1">
      {/* 工具栏骨架 */}
      <div className="mb-4">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      {/* 卡片网格骨架 */}
      <div className="masonry-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="masonry-item">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Skeleton className="w-full h-48" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
