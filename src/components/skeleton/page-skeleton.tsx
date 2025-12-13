/**
 * 页面骨架屏组件
 * V5.0: 用于首次加载时的视觉占位
 *
 * 特点：
 * - 与实际布局保持一致，避免布局偏移
 * - 动画效果提供加载反馈
 * - 响应式设计
 */

"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * 首页骨架屏
 * 包含筛选栏 + 书签卡片网格
 */
export function HomePageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* 顶部筛选栏骨架 */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
        <div className="flex-1" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>

      {/* 书签卡片网格骨架 - 6 张卡片 (2x3) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <BookmarkCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * 书签卡片骨架屏
 * 与实际 BookmarkCard 布局保持一致
 */
export function BookmarkCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* 封面图骨架 */}
      <Skeleton className="h-40 w-full" />

      {/* 内容区骨架 */}
      <div className="space-y-3 p-4">
        {/* 标题 */}
        <Skeleton className="h-5 w-3/4" />

        {/* 描述 - 两行 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* 标签 */}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        {/* 底部元信息 */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* 底部颜色条 */}
      <Skeleton className="h-1 w-full rounded-b-lg" />
    </div>
  );
}

/**
 * 书签列表骨架屏
 * 用于列表视图模式
 */
export function BookmarkListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border bg-card p-4"
        >
          {/* Favicon */}
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />

          {/* 内容 */}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          {/* 操作按钮 */}
          <Skeleton className="h-8 w-8 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * 统计卡片骨架屏
 */
export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="mb-2 h-4 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * 空状态骨架屏
 * 用于首次访问时的引导页面
 */
export function EmptyStateSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Skeleton className="mb-4 h-24 w-24 rounded-full" />
      <Skeleton className="mb-2 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

/**
 * 通用内容骨架屏
 * 可配置行数
 */
export function ContentSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
}
