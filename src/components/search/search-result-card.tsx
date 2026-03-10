/**
 * 搜索结果卡片组件
 *
 * 包装 BookmarkCard，添加悬停预览功能
 * 专用于搜索结果页面
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { useState, useRef, useCallback, memo } from "react";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { SearchPreviewPanel } from "./search-preview-panel";
import type { Bookmark } from "@/types/supabase";
import type { BookmarkV42Fields } from "@/lib/classification-v2/types/legacy-compat";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface SearchResultCardProps {
  /** 书签数据 */
  bookmark: Bookmark &
    Partial<BookmarkV42Fields> & {
      folders?: { name: string } | null;
    };
  /** 编辑回调 */
  onEdit?: (id: number) => void;
  /** 删除回调 */
  onDelete?: (id: number) => void;
  /** 切换已读状态回调 */
  onToggleRead?: (id: number, isRead: boolean) => void;
  /** 切换星标状态回调 */
  onToggleStarred?: (id: number, isStarred: boolean) => void;
  /** 查看详情回调 */
  onViewDetail?: (bookmark: Bookmark) => void;
  /** 是否启用预览面板 */
  enablePreview?: boolean;
  /** 预览面板位置 */
  previewPosition?: "left" | "right" | "auto";
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 常量
// ============================================

/** 悬停延迟时间（毫秒） */
const HOVER_DELAY = 500;

/** 离开延迟时间（毫秒） */
const LEAVE_DELAY = 150;

// ============================================
// 组件
// ============================================

/**
 * 搜索结果卡片
 * 带有悬停预览功能的书签卡片
 */
export const SearchResultCard = memo(function SearchResultCard({
  bookmark,
  onEdit,
  onDelete,
  onToggleRead,
  onToggleStarred,
  onViewDetail,
  enablePreview = true,
  previewPosition = "auto",
  className,
}: SearchResultCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [calculatedPosition, setCalculatedPosition] = useState<
    "left" | "right"
  >("right");
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 计算预览面板位置
   * 根据卡片在视口中的位置自动选择左侧或右侧
   */
  const calculatePosition = useCallback((): "left" | "right" => {
    if (previewPosition !== "auto") {
      return previewPosition;
    }

    if (!containerRef.current) {
      return "right";
    }

    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const cardCenterX = rect.left + rect.width / 2;

    // 如果卡片在视口右半部分，预览面板显示在左侧
    return cardCenterX > viewportWidth / 2 ? "left" : "right";
  }, [previewPosition]);

  /**
   * 处理鼠标进入
   */
  const handleMouseEnter = useCallback(() => {
    // 清除离开定时器
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }

    // 设置悬停定时器
    if (!showPreview && enablePreview) {
      hoverTimerRef.current = setTimeout(() => {
        setCalculatedPosition(calculatePosition());
        setShowPreview(true);
      }, HOVER_DELAY);
    }
  }, [showPreview, enablePreview, calculatePosition]);

  /**
   * 处理鼠标离开
   */
  const handleMouseLeave = useCallback(() => {
    // 清除悬停定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    // 设置离开定时器
    if (showPreview) {
      leaveTimerRef.current = setTimeout(() => {
        setShowPreview(false);
      }, LEAVE_DELAY);
    }
  }, [showPreview]);

  /**
   * 处理预览面板关闭
   */
  const handlePreviewClose = useCallback(() => {
    setShowPreview(false);
  }, []);

  /**
   * 处理预览面板的鼠标进入（保持预览显示）
   */
  const handlePreviewMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 书签卡片 */}
      <BookmarkCard
        bookmark={bookmark}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleRead={onToggleRead}
        onToggleStarred={onToggleStarred}
      />

      {/* 预览面板 */}
      {enablePreview && (
        <div onMouseEnter={handlePreviewMouseEnter}>
          <SearchPreviewPanel
            bookmark={bookmark}
            visible={showPreview}
            position={calculatedPosition}
            onClose={handlePreviewClose}
            onViewDetail={onViewDetail}
          />
        </div>
      )}
    </div>
  );
});

export default SearchResultCard;
