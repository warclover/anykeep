/**
 * 用途标签按钮组件
 * 统一的标签按钮样式，支持选择器和筛选器两种场景
 *
 * @performance 使用 React.memo 优化，避免列表中不必要的重渲染
 * @since V4.2.2 添加 memo 优化
 */

"use client";

import { memo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedUsageTag } from "@/lib/constants/usage-tags";

export interface UsageTagButtonProps {
  /** 标签数据 */
  tag: UnifiedUsageTag;
  /** 是否选中 */
  isSelected: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸：sm 用于筛选器，md 用于选择器 */
  size?: "sm" | "md";
  /** 选中时是否显示移除图标 */
  showRemoveIcon?: boolean;
  /** 点击回调 */
  onClick?: () => void;
}

export const UsageTagButton = memo(function UsageTagButton({
  tag,
  isSelected,
  disabled = false,
  size = "md",
  showRemoveIcon = false,
  onClick,
}: UsageTagButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // 基础样式
        "rounded-full font-medium transition-all duration-200",
        "border whitespace-nowrap flex-shrink-0",
        // 尺寸
        size === "sm"
          ? "px-2.5 py-1 text-xs"
          : "px-3 py-1.5 text-sm flex items-center gap-1.5",
        // 焦点样式（仅 md 尺寸）
        size === "md" && "focus:outline-none focus:ring-2 focus:ring-offset-1",
        // 选中状态
        isSelected
          ? cn(
              tag.style.bgLight,
              tag.style.bgDark,
              tag.style.borderLight,
              tag.style.borderDark,
              tag.style.textLight,
              tag.style.textDark,
              size === "md" && [
                "ring-offset-white dark:ring-offset-gray-900",
                `focus:ring-${tag.style.color}-400`,
              ],
            )
          : cn(
              // 未选中状态
              "bg-white dark:bg-gray-800",
              "border-gray-200 dark:border-gray-700",
              "text-gray-600 dark:text-gray-400",
              "hover:border-gray-300 dark:hover:border-gray-600",
              size === "md" && [
                "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                "focus:ring-gray-400",
              ],
            ),
        // 禁用状态
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {tag.label}
      {/* 移除图标（仅选中时且启用时显示） */}
      {isSelected && showRemoveIcon && (
        <X className="size-3.5 opacity-60 hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
});
