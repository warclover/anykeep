/**
 * FAB 子按钮组件
 *
 * 用于 FAB 扩展菜单中的子操作按钮
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FAB_STYLES } from "./fab-constants";

// ============================================
// 类型定义
// ============================================

export interface FABItemProps {
  /** 图标组件 */
  icon: LucideIcon;
  /** 按钮标签文字 */
  label: string;
  /** 点击回调 */
  onClick: () => void;
  /** 是否可见 */
  visible: boolean;
  /** 动画延迟索引（用于 stagger 动画） */
  index: number;
  /** 自定义样式 */
  className?: string;
}

// ============================================
// 组件
// ============================================

export function FABItem({
  icon: Icon,
  label,
  onClick,
  visible,
  index,
  className,
}: FABItemProps) {
  // 计算垂直偏移量（从底部往上）
  const translateY = visible ? -((index + 1) * FAB_STYLES.ITEM_GAP) : 0;
  const delay = index * FAB_STYLES.STAGGER_DELAY;

  return (
    <div
      className={cn(
        "absolute bottom-0 right-0 flex items-center gap-3",
        "transition-all duration-200 ease-out",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{
        transform: `translateY(${translateY}px)`,
        transitionDelay: visible ? `${delay}ms` : "0ms",
      }}
    >
      {/* 标签文字 */}
      <span
        className={cn(
          "px-3 py-1.5 rounded-lg text-sm font-medium",
          "bg-gray-900/90 text-white dark:bg-gray-100 dark:text-gray-900",
          "shadow-lg backdrop-blur-sm",
          "whitespace-nowrap",
          "transition-all duration-200",
          visible ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0",
        )}
        style={{
          transitionDelay: visible ? `${delay + 50}ms` : "0ms",
        }}
      >
        {label}
      </span>

      {/* 图标按钮 */}
      <Button
        size="icon"
        onClick={onClick}
        className={cn(
          FAB_STYLES.ITEM_SIZE,
          "rounded-full shadow-lg",
          "bg-white dark:bg-gray-800",
          "text-gray-700 dark:text-gray-200",
          "hover:bg-gray-50 dark:hover:bg-gray-700",
          "hover:shadow-xl",
          "transition-all duration-200",
          "border border-gray-200 dark:border-gray-700",
          className,
        )}
        aria-label={label}
      >
        <Icon className="size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
