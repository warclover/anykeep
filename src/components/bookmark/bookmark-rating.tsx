/**
 * 收藏评级UI组件
 * 提供评级、锁定和删除标记功能
 */

"use client";

import { useState } from "react";
import { Star, Lock, Unlock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BookmarkRatingProps {
  rating: number; // 0-5
  isLocked: boolean;
  isMarkedForDeletion: boolean; // 标记为待删除（仅UI标识）
  onRatingChange: (rating: number) => void;
  onLockToggle: () => void;
  onMarkerToggle: () => void; // 切换删除标记
  /** 尺寸：sm = 紧凑布局，md = 默认 */
  size?: "sm" | "md";
  className?: string;
}

export function BookmarkRating({
  rating,
  isLocked,
  isMarkedForDeletion,
  onRatingChange,
  onLockToggle,
  onMarkerToggle,
  size = "md",
  className,
}: BookmarkRatingProps) {
  const isCompact = size === "sm";
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleStarClick = (starIndex: number) => {
    // 点击当前评级：取消评级（设为 0）
    if (rating === starIndex) {
      onRatingChange(0);
    } else {
      onRatingChange(starIndex);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center",
        isCompact ? "gap-1.5" : "gap-2 md:gap-3",
        className,
      )}
    >
      {/* 删除标记按钮（切换状态） */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMarkerToggle}
        title={isMarkedForDeletion ? "点击取消删除标记" : "点击标记为待删除"}
        className={cn(
          "transition-colors",
          isCompact ? "h-6 w-6" : "h-8 w-8 md:h-9 md:w-9",
          isMarkedForDeletion
            ? "text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
            : "text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800",
        )}
      >
        <Trash2 className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>

      {/* 分隔线 */}
      <div
        className={cn(
          "w-px bg-gray-200 dark:bg-gray-700",
          isCompact ? "h-4" : "h-6",
        )}
      />

      {/* 星星评级 */}
      <div
        className={cn(
          "flex items-center",
          isCompact ? "gap-0.5" : "gap-0.5 md:gap-1",
        )}
      >
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const isFilled =
            starIndex <= (hoveredRating > 0 ? hoveredRating : rating);

          return (
            <button
              key={starIndex}
              type="button"
              onClick={() => handleStarClick(starIndex)}
              onMouseEnter={() => setHoveredRating(starIndex)}
              onMouseLeave={() => setHoveredRating(0)}
              className={cn(
                "transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 rounded",
                isCompact ? "p-0.5" : "p-0.5",
              )}
            >
              <Star
                className={cn(
                  "transition-colors",
                  isCompact ? "h-4 w-4" : "h-4 w-4 md:h-5 md:w-5",
                  isFilled
                    ? "fill-orange-500 text-orange-500"
                    : "text-gray-300 dark:text-gray-600",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* 分隔线 */}
      <div
        className={cn(
          "w-px bg-gray-200 dark:bg-gray-700",
          isCompact ? "h-4" : "h-6",
        )}
      />

      {/* 锁定按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onLockToggle}
        title={isLocked ? "点击解锁" : "点击锁定（防止误删）"}
        className={cn(
          "transition-colors",
          isCompact ? "h-6 w-6" : "h-8 w-8 md:h-9 md:w-9",
          isLocked
            ? "text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
            : "text-gray-400 dark:text-gray-500 hover:text-yellow-600 hover:bg-gray-100 dark:hover:bg-gray-800",
        )}
      >
        {isLocked ? (
          <Lock className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        ) : (
          <Unlock className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        )}
      </Button>
    </div>
  );
}
