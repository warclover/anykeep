/**
 * 主内容区骨架屏
 * 用于 Suspense fallback，首次加载时提供视觉反馈
 *
 * 设计原则：
 * - 纯 CSS 动画，无 JS 依赖
 * - 高度匹配实际内容区布局，避免 CLS
 * - 模拟标题栏 + 卡片网格结构
 */

export function MainContentSkeleton() {
  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 animate-pulse">
      {/* 模拟顶部标题区域 */}
      <div className="mb-6">
        <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded-md" />
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded-md mt-2" />
      </div>

      {/* 模拟卡片网格（3列布局） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* 模拟封面图 */}
            <div className="aspect-[2.35/1] bg-gray-200 dark:bg-gray-700" />
            {/* 模拟标题 */}
            <div className="p-3">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mt-2" />
              <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
              {/* 模拟底部元信息 */}
              <div className="flex justify-between mt-3">
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
