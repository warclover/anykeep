/**
 * 通知徽章
 * @description 显示未读通知数量
 */

"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface NotificationBadgeProps {
  /** 未读数量 */
  count: number;
  /** 最大显示数量 */
  max?: number;
  /** 是否有重要消息（触发动画） */
  hasImportant?: boolean;
  /** 尺寸 */
  size?: "sm" | "md";
  /** 自定义类名 */
  className?: string;
}

export function NotificationBadge({
  count,
  max = 99,
  hasImportant = false,
  size = "md",
  className,
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : String(count);

  return (
    <Badge
      variant="destructive"
      className={cn(
        "font-medium tabular-nums",
        size === "sm" && "h-4 min-w-4 px-1 text-[10px]",
        size === "md" && "h-5 min-w-5 px-1.5 text-xs",
        hasImportant && "animate-pulse",
        className,
      )}
    >
      {displayCount}
    </Badge>
  );
}
