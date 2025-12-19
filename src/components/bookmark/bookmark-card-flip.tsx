/**
 * 翻转卡片组件 - 基于 VueConf 设计
 * V4.2: 使用 React.memo 优化，避免列表中其他卡片变化时的不必要重渲染
 * 正面：封面 + 标题 + 标签（简洁）
 * 背面：AI 摘要 + 详细信息
 */

"use client";

import { useState, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw, ExternalLink, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Bookmark, Platform } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { generatePlaceholderImage } from "@/lib/utils/placeholder-image";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { getDisplaySummary } from "@/lib/classification/types/ai-summary";
import "./bookmark-card-flip.css";

interface FlipBookmarkCardProps {
  bookmark: Bookmark & {
    folders?: { name: string } | null;
  };
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onToggleRead?: (id: number, isRead: boolean) => void;
  // 批量选择模式
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  // 翻转配置
  enableFlip?: boolean; // 是否启用翻转效果
}

export const FlipBookmarkCard = memo(function FlipBookmarkCard({
  bookmark,
  onEdit: _onEdit,
  onDelete: _onDelete,
  onToggleRead,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  enableFlip = true,
}: FlipBookmarkCardProps) {
  const router = useRouter();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 生成封面图
  const coverImage =
    getProxiedImageUrl(bookmark.cover_url) ||
    generatePlaceholderImage(bookmark.title, bookmark.platform as Platform);

  // 平台色彩映射
  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      WECHAT_OFFICIAL_ACCOUNT: "#07C160", // 微信绿
      BILIBILI: "#FB7299", // B站粉
      XIAOHONGSHU: "#FF2442", // 小红书红
      BROWSER_CHROME: "#4285F4", // Chrome蓝
      BROWSER_EDGE: "#0078D7", // Edge蓝
      BROWSER_FIREFOX: "#FF7139", // Firefox橙
      BROWSER_SAFARI: "#006CFF", // Safari蓝
      UNKNOWN: "#6B7280", // 灰色
    };
    return colors[platform] || colors.UNKNOWN;
  };

  // 桌面端 Hover 翻转
  const handleMouseEnter = () => {
    if (!isMobile && enableFlip && !isSelectionMode) {
      setIsFlipped(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && enableFlip && !isSelectionMode) {
      setIsFlipped(false);
    }
  };

  // 移动端点击翻转（排除链接点击）
  const handleCardClick = (e: React.MouseEvent) => {
    // 桌面端不处理点击翻转（由 hover 控制）
    if (!isMobile) {
      return;
    }

    // 如果是批量选择模式，不翻转
    if (isSelectionMode) {
      e.preventDefault();
      onToggleSelect?.(bookmark.id);
      return;
    }

    // 如果点击的是按钮或链接，不翻转
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }

    // 翻转卡片（仅移动端）
    e.preventDefault();
    if (enableFlip) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleToggleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.(bookmark.id);
  };

  const handleOpenOriginal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
    // 自动标记为已读
    if (!bookmark.is_read && onToggleRead) {
      onToggleRead(bookmark.id, true);
    }
  };

  // 非翻转模式：处理卡片点击导航（使用程序化导航确保可靠性）
  const handleNonFlipCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      handleToggleSelect(e);
      return;
    }
    e.preventDefault();
    router.push(`/bookmark/${bookmark.id}`);
  };

  // 如果不启用翻转，使用原始卡片（降级方案）
  if (!enableFlip) {
    return (
      <Link
        href={isSelectionMode ? "#" : `/bookmark/${bookmark.id}`}
        onClick={handleNonFlipCardClick}
        className="block h-full"
      >
        <div className="h-full hover:shadow-md transition-shadow cursor-pointer flex flex-col group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          {/* 使用原始卡片布局 */}
          <div className="relative aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={bookmark.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2">
              <PlatformBadge platform={bookmark.platform} size="md" showName />
            </div>
          </div>
          <div className="p-4 flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
              {bookmark.title}
            </h3>
            {getDisplaySummary(bookmark.ai_summary) && (
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                {getDisplaySummary(bookmark.ai_summary)}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flip-card-container card-hover-effect",
        isSelected && "ring-2 ring-blue-500 dark:ring-blue-400 rounded-lg",
      )}
    >
      <div
        className={cn("flip-card", isFlipped && "is-flipped")}
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        aria-label={`收藏卡片: ${bookmark.title}。${isMobile ? "点击" : "悬停"}翻转查看详情`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsFlipped(!isFlipped);
          }
        }}
      >
        {/* ===== 正面 ===== */}
        <div className="flip-card-front">
          <div className="flex flex-col h-full">
            {/* 平台色条 */}
            <div
              className="h-1 w-full"
              style={{ backgroundColor: getPlatformColor(bookmark.platform) }}
            />

            {/* 封面图 - P0.1: 16:9 + 顶部对齐 */}
            <div className="relative aspect-video overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt={bookmark.title}
                className="w-full h-full object-cover card-cover-top card-cover-zoom"
              />

              {/* 平台标识 - P0.5: 放大 + 固定左上角 */}
              <div className="absolute top-3 left-3">
                <PlatformBadge
                  platform={bookmark.platform}
                  size="lg"
                  showName
                />
              </div>

              {/* 批量选择复选框 */}
              {isSelectionMode && (
                <div
                  className="absolute top-3 right-3"
                  onClick={handleToggleSelect}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-blue-500 border-blue-500"
                        : "bg-white/90 border-gray-300",
                    )}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
              )}

              {/* 翻转指示器 */}
              {!isSelectionMode && (
                <div className="flip-indicator">
                  <RotateCcw className="size-4 text-white" />
                </div>
              )}
            </div>

            {/* 内容区域 - P0.4: 增加图文间距 */}
            <div className="p-4 pt-3 flex-1 flex flex-col card-content-spacing">
              {/* 标题 - 固定2行高度，单行时留白 */}
              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-3 text-lg leading-snug min-h-[3.25rem]">
                {bookmark.title}
              </h3>

              {/* 标签 - 单行显示，超出用+N */}
              <div className="flex items-center gap-1.5 mb-3 h-6 overflow-hidden">
                {bookmark.ai_tags && bookmark.ai_tags.length > 0 ? (
                  <>
                    {bookmark.ai_tags.slice(0, 2).map((tag, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex-shrink-0"
                      >
                        #{tag}
                      </Badge>
                    ))}
                    {bookmark.ai_tags.length > 2 && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 flex-shrink-0"
                      >
                        +{bookmark.ai_tags.length - 2}
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-400">暂无标签</span>
                )}
              </div>

              {/* 底部元信息 */}
              <div className="mt-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="truncate">
                  {bookmark.source_name || bookmark.author || "未知作者"}
                </span>
                <span>·</span>
                <span className="flex-shrink-0">
                  {formatRelativeTime(
                    bookmark.publish_time || bookmark.created_at || new Date(),
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 背面 ===== */}
        <div className="flip-card-back">
          <div className="flex flex-col h-full p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
            {/* 背面头部 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  AI 智能摘要
                </h4>
                {/* 翻转回去按钮 */}
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                  }}
                  aria-label="翻转回正面"
                >
                  <RotateCcw className="size-4" />
                </button>
              </div>
              <div className="h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
            </div>

            {/* AI 摘要 */}
            <div className="flex-1 overflow-y-auto">
              {getDisplaySummary(bookmark.ai_summary) ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {getDisplaySummary(bookmark.ai_summary)}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">暂无 AI 摘要</p>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                {/* 阅读原文 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenOriginal}
                  className="flex-1"
                >
                  <ExternalLink className="size-4 mr-2" />
                  阅读原文
                </Button>

                {/* 进入详情页 */}
                <Link href={`/bookmark/${bookmark.id}`} className="flex-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className="size-4 mr-2" />
                    详情页
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
