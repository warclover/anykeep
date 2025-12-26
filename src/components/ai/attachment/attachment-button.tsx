/**
 * AI 附件按钮组件
 *
 * 用于打开附件选择面板的触发按钮
 * 支持三种状态：空（灰色）、有附件（粉色）、已满（橙色）
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { forwardRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ATTACHMENT_LIMITS, ATTACHMENT_TEXT } from "./types";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentButtonProps {
  /** 已选附件数量 */
  count: number;
  /** 最大数量，默认 3 */
  maxCount?: number;
  /** 点击回调 */
  onClick?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 组件实现
// =============================================================================

/**
 * 附件按钮组件
 *
 * 状态变化：
 * - count = 0: 灰色 + 图标
 * - 0 < count < max: 粉色背景 + 数字
 * - count = max: 橙色背景 + N/N
 */
export const AttachmentButton = forwardRef<
  HTMLButtonElement,
  AttachmentButtonProps
>(function AttachmentButton(
  {
    count,
    maxCount = ATTACHMENT_LIMITS.MAX_COUNT,
    onClick,
    disabled = false,
    className,
  },
  ref,
) {
  const isEmpty = count === 0;
  const isFull = count >= maxCount;

  // 确定按钮样式
  const buttonStyles = cn(
    // 基础样式
    "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
    "flex-shrink-0",
    // 状态样式
    isEmpty && [
      "bg-gray-100 text-gray-500",
      "hover:bg-gray-200 hover:text-gray-600",
    ],
    !isEmpty &&
      !isFull && [
        "bg-gradient-to-r from-pink-400 to-rose-400 text-white",
        "shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:scale-105",
      ],
    isFull && [
      "bg-gradient-to-r from-orange-400 to-amber-400 text-white",
      "shadow-lg shadow-orange-200 hover:shadow-orange-300 hover:scale-105",
    ],
    // 禁用状态
    disabled && "opacity-50 cursor-not-allowed hover:scale-100 shadow-none",
    className,
  );

  // 渲染按钮内容
  const renderContent = () => {
    if (isEmpty) {
      return <Plus className="size-4" />;
    }

    if (isFull) {
      return (
        <span className="text-[10px] font-medium">
          {count}/{maxCount}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-0.5">
        <Plus className="size-3" />
        <span className="text-[10px] font-medium">{count}</span>
      </span>
    );
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonStyles}
      title={ATTACHMENT_TEXT.BUTTON_TITLE}
      aria-label={`${ATTACHMENT_TEXT.BUTTON_TITLE} (${count}/${maxCount})`}
    >
      {renderContent()}
    </button>
  );
});

export default AttachmentButton;
