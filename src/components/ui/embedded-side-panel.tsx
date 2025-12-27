/**
 * 通用挤压式侧边面板组件
 *
 * 用于与 AI 助理面板一样的挤压式布局
 * 支持自定义宽度、标题和内容
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmbeddedSidePanelProps {
  /** 是否展开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 面板标题 */
  title: string;
  /** 标题图标 */
  titleIcon?: React.ReactNode;
  /** 面板宽度，默认 360px */
  width?: number;
  /** 自定义 className */
  className?: string;
  /** 自定义头部 className（用于渐变背景） */
  headerClassName?: string;
  /** 自定义标题 className（用于标题颜色） */
  titleClassName?: string;
  /** 自定义关闭按钮 className */
  closeButtonClassName?: string;
  /** 头部右侧操作按钮 */
  headerAction?: React.ReactNode;
  /** 底部内容 */
  footer?: React.ReactNode;
  /** 子内容 */
  children: React.ReactNode;
}

/**
 * 通用挤压式侧边面板组件
 *
 * 特点：
 * - 固定宽度（可配置）
 * - 与内容区并排显示
 * - 支持平滑过渡动画
 * - 有关闭按钮
 */
export function EmbeddedSidePanel({
  open,
  onClose,
  title,
  titleIcon,
  width = 360,
  className,
  headerClassName,
  titleClassName,
  closeButtonClassName,
  headerAction,
  footer,
  children,
}: EmbeddedSidePanelProps) {
  return (
    <div
      className={cn(
        // 基础样式 - 圆角卡片风格
        "flex-shrink-0 bg-white dark:bg-gray-900 rounded-l-2xl border border-r-0 border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden",
        // 外边距，让面板悬浮感更强
        "my-3 mr-0",
        // 过渡动画
        "transition-all duration-300 ease-in-out",
        // 展开/收起状态
        open ? "opacity-100" : "w-0 opacity-0",
        className,
      )}
      style={{
        // 动态宽度
        width: open ? `${width}px` : 0,
        // 确保收起时不占用空间
        visibility: open ? "visible" : "hidden",
      }}
    >
      {/* 只在展开时渲染内容，避免性能浪费 */}
      {open && (
        <div className="h-full flex flex-col" style={{ width: `${width}px` }}>
          {/* Header */}
          <div
            className={cn(
              "flex-shrink-0 h-14 px-4 flex items-center justify-between border-b",
              // 默认样式
              "border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900",
              // 自定义样式覆盖
              headerClassName,
            )}
          >
            {/* 标题 */}
            <div className="flex items-center gap-2">
              {titleIcon}
              <h2
                className={cn(
                  "text-base font-semibold",
                  // 默认颜色
                  "text-gray-900 dark:text-gray-100",
                  // 自定义颜色覆盖
                  titleClassName,
                )}
              >
                {title}
              </h2>
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-2">
              {headerAction}
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center",
                  "text-gray-500 hover:text-gray-700",
                  "dark:text-gray-400 dark:hover:text-gray-200",
                  "hover:bg-gray-100/50 dark:hover:bg-gray-800/50",
                  "transition-colors duration-150",
                  closeButtonClassName,
                )}
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Content - 可滚动 */}
          <div className="flex-1 overflow-y-auto p-4">{children}</div>

          {/* Footer - 可选 */}
          {footer && (
            <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmbeddedSidePanel;
