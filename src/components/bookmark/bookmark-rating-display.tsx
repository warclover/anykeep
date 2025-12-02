/**
 * 收藏评级显示组件（仅展示，不可交互）
 * 用于卡片视图中展示评级和锁定状态
 */

"use client";

import { Star, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookmarkRatingDisplayProps {
  rating: number; // 0-5
  isLocked: boolean;
  variant?: "default" | "compact";
  className?: string;
}

export function BookmarkRatingDisplay({
  rating,
  isLocked,
  variant = "default",
  className,
}: BookmarkRatingDisplayProps) {
  // 如果没有评级也没有锁定，不显示任何内容
  if (rating === 0 && !isLocked) {
    return null;
  }

  const starSize = variant === "compact" ? "size-3" : "size-4";
  const lockSize = variant === "compact" ? "size-3" : "size-4";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* 星星评级（仅显示实际评分数量） */}
      {rating > 0 && (
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, index) => (
            <Star
              key={index}
              className={cn(
                starSize,
                index < rating
                  ? "fill-orange-500 text-orange-500"
                  : "text-gray-300 dark:text-gray-600",
              )}
            />
          ))}
        </div>
      )}

      {/* 锁定图标 */}
      {isLocked && (
        <Lock
          className={cn(lockSize, "text-yellow-600 dark:text-yellow-500")}
        />
      )}
    </div>
  );
}
