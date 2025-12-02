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
  className?: string;
}

export function BookmarkRating({
  rating,
  isLocked,
  isMarkedForDeletion,
  onRatingChange,
  onLockToggle,
  onMarkerToggle,
  className,
}: BookmarkRatingProps) {
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
    <div className={cn("flex items-center gap-2 md:gap-3", className)}>
      {/* 删除标记按钮（切换状态） */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMarkerToggle}
        title={isMarkedForDeletion ? "点击取消删除标记" : "点击标记为待删除"}
        className={cn(
          "h-8 w-8 md:h-9 md:w-9 transition-colors",
          isMarkedForDeletion
            ? "text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
            : "text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800",
        )}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* 分隔线 */}
      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

      {/* 星星评级 */}
      <div className="flex items-center gap-0.5 md:gap-1">
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
              className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded"
            >
              <Star
                className={cn(
                  "h-4 w-4 md:h-5 md:w-5 transition-colors",
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
      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

      {/* 锁定按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onLockToggle}
        title={isLocked ? "点击解锁" : "点击锁定（防止误删）"}
        className={cn(
          "h-8 w-8 md:h-9 md:w-9 transition-colors",
          isLocked
            ? "text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
            : "text-gray-400 dark:text-gray-500 hover:text-yellow-600 hover:bg-gray-100 dark:hover:bg-gray-800",
        )}
      >
        {isLocked ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Unlock className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
