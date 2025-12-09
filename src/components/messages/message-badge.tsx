/**
 * 消息角标组件
 * @description 显示未读消息数量的角标
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface MessageBadgeProps {
  /** 未读数量 */
  count: number;
  /** 是否包含重要消息 */
  hasImportant?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 最大显示数字 */
  max?: number;
}

// ============================================
// 组件实现
// ============================================

export function MessageBadge({
  count,
  hasImportant = false,
  className,
  max = 99,
}: MessageBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > max ? `${max}+` : String(count);

  return (
    <Badge
      variant="destructive"
      className={cn(
        "px-1.5 py-0.5 text-xs font-medium min-w-[1.25rem] h-5 flex items-center justify-center",
        hasImportant && "animate-pulse",
        className,
      )}
    >
      {displayCount}
    </Badge>
  );
}
