/**
 * 简报骨架屏组件
 *
 * 数据加载时显示的占位内容
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

"use client";

import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface BriefingSkeletonProps {
  /** 洞察项数量 */
  insightCount?: number;
  /** 操作按钮数量 */
  actionCount?: number;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 组件实现
// ============================================

/**
 * 简报骨架屏
 *
 * @example
 * ```tsx
 * <BriefingSkeleton insightCount={3} actionCount={2} />
 * ```
 */
export function BriefingSkeleton({
  insightCount = 3,
  actionCount = 2,
  className,
}: BriefingSkeletonProps) {
  return (
    <Card
      className={cn(
        "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent",
        className,
      )}
      data-testid="briefing-skeleton"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 图标占位 */}
            <Skeleton className="h-6 w-6 rounded-full" />
            {/* 标题占位 */}
            <Skeleton className="h-5 w-20" />
            {/* 徽章占位 */}
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* 关闭按钮占位 */}
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 摘要占位 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* 洞察列表占位 */}
        <div className="space-y-2">
          {Array.from({ length: insightCount }).map((_, index) => (
            <InsightSkeleton key={index} />
          ))}
        </div>

        {/* 操作按钮占位 */}
        <div className="flex gap-2">
          {Array.from({ length: actionCount }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// 洞察项骨架屏
// ============================================

function InsightSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background/50 p-3">
      {/* 图标占位 */}
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />

      {/* 内容占位 */}
      <div className="flex-1 space-y-1.5">
        {/* 标签 */}
        <Skeleton className="h-3 w-16" />
        {/* 标题 */}
        <Skeleton className="h-4 w-3/4" />
        {/* 摘要 */}
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// ============================================
// 紧凑版骨架屏
// ============================================

export interface CompactBriefingSkeletonProps {
  /** 自定义类名 */
  className?: string;
}

/**
 * 紧凑版简报骨架屏
 *
 * 用于侧边栏或小空间展示
 */
export function CompactBriefingSkeleton({
  className,
}: CompactBriefingSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-primary/20 bg-primary/5 p-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-2 space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}
