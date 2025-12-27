/**
 * MD 阅读器高亮工具栏组件
 * Spec: md-reader-upgrade / REQ-10
 *
 * 功能：
 * - 浮动在选区上方
 * - 5 种颜色圆点可选
 * - 编辑模式支持更换颜色/删除
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HIGHLIGHT_COLOR_LIST,
  HIGHLIGHT_TOOLBAR_CONFIG,
} from "../../lib/reader/highlight-config";
import type { HighlightToolbarProps, HighlightColor } from "../../types/reader";

/**
 * 高亮工具栏组件
 *
 * 根据位置浮动在选区上方，提供颜色选择功能。
 * 编辑模式下可以更改颜色或删除高亮。
 *
 * @example
 * ```tsx
 * <HighlightToolbar
 *   position={{ x: 100, y: 200 }}
 *   onColorSelect={(color) => handleColorSelect(color)}
 *   onClose={() => setShowToolbar(false)}
 * />
 *
 * // 编辑模式
 * <HighlightToolbar
 *   position={{ x: 100, y: 200 }}
 *   existingColor="yellow"
 *   onColorSelect={(color) => handleUpdateColor(highlightId, color)}
 *   onDelete={() => handleDeleteHighlight(highlightId)}
 *   onClose={() => setShowToolbar(false)}
 * />
 * ```
 */
export function HighlightToolbar({
  position,
  onColorSelect,
  onClose,
  existingColor,
  onDelete,
}: HighlightToolbarProps) {
  // 显示状态（用于动画）
  const [isVisible, setIsVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 工具栏尺寸配置
  const { fadeInDuration, colorDotSize, hoverScale, gap } =
    HIGHLIGHT_TOOLBAR_CONFIG;

  // 是否为编辑模式
  const isEditMode = !!existingColor;

  // 工具栏可见性 - 依赖于 position 直接计算
  const computedVisible = !!position;

  // 挂载时显示动画
  useEffect(() => {
    if (computedVisible) {
      // 使用 requestAnimationFrame 确保 DOM 更新后触发动画
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      // 使用 requestAnimationFrame 避免 ESLint 警告
      requestAnimationFrame(() => {
        setIsVisible(false);
      });
    }
  }, [computedVisible]);

  // 点击外部关闭
  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // 延迟添加事件监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [position, onClose]);

  // Escape 键关闭
  useEffect(() => {
    if (!position) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [position, onClose]);

  // 不显示时返回 null
  if (!position) {
    return null;
  }

  // 计算工具栏位置（居中对齐，在选区上方）
  const toolbarWidth = isEditMode
    ? (colorDotSize + 8) * HIGHLIGHT_COLOR_LIST.length + 40 + 16 // 颜色 + 删除按钮 + padding
    : (colorDotSize + 8) * HIGHLIGHT_COLOR_LIST.length + 16; // 颜色 + padding

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, position.x - toolbarWidth / 2), // 防止超出屏幕左边
    top: Math.max(8, position.y - colorDotSize - gap - 12), // 防止超出屏幕顶部
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateY(0)" : "translateY(4px)",
    transition: `opacity ${fadeInDuration}ms ease-out, transform ${fadeInDuration}ms ease-out`,
    zIndex: 9999,
  };

  /**
   * 处理颜色选择
   */
  const handleColorClick = (color: HighlightColor) => {
    onColorSelect(color);
  };

  /**
   * 处理删除
   */
  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

  return (
    <div
      ref={toolbarRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5",
        "bg-white dark:bg-zinc-800",
        "shadow-lg border border-zinc-200 dark:border-zinc-700",
        "select-none",
      )}
      role="toolbar"
      aria-label="高亮工具栏"
    >
      {/* 颜色选择 */}
      <div className="flex items-center gap-1">
        {HIGHLIGHT_COLOR_LIST.map((colorConfig) => {
          const isSelected = existingColor === colorConfig.id;

          return (
            <button
              key={colorConfig.id}
              onClick={() => handleColorClick(colorConfig.id)}
              className={cn(
                "rounded-full transition-transform",
                "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500",
                isSelected &&
                  "ring-2 ring-offset-1 ring-zinc-400 dark:ring-zinc-500",
              )}
              style={{
                width: colorDotSize,
                height: colorDotSize,
                backgroundColor: colorConfig.bg,
                transform: isSelected ? `scale(${hoverScale})` : "scale(1)",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = `scale(${hoverScale})`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
              title={colorConfig.label}
              aria-label={`${colorConfig.label} (${colorConfig.id})`}
              aria-pressed={isSelected}
            />
          );
        })}
      </div>

      {/* 编辑模式：删除按钮 */}
      {isEditMode && onDelete && (
        <>
          {/* 分隔线 */}
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

          <button
            onClick={handleDelete}
            className={cn(
              "p-1 rounded-md transition-colors",
              "text-zinc-500 hover:text-red-500",
              "hover:bg-red-50 dark:hover:bg-red-900/20",
              "focus:outline-none focus:ring-2 focus:ring-red-500",
            )}
            title="删除高亮"
            aria-label="删除高亮"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

export default HighlightToolbar;
