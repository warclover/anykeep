/**
 * SnapshotViewer Component (V4.2.1)
 * 快照内容查看器 - 显示网页快照的可读内容和截图
 *
 * 功能：
 * - 加载快照内容
 * - 显示可读化的文章内容
 * - 显示页面截图（Full 快照）
 * - 视图模式切换（文本/截图）
 * - 元数据展示（标题、作者、字数）
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  Calendar,
  FileText,
  User,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  AlignLeft,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { API_SNAPSHOTS } from "@/lib/constants/api-paths";

// ============================================================================
// 类型定义
// ============================================================================

type ViewMode = "text" | "screenshot";

export interface SnapshotContent {
  id: number;
  readableTitle: string | null;
  readableContent: string | null;
  readableTextContent: string | null;
  readableExcerpt: string | null;
  readableByline: string | null;
  readableWordCount: number | null;
  capturedAt: string | null;
  finalUrl: string | null;
  originalUrl: string;
  /** 快照类型 */
  snapshotType?: string;
  /** 截图 URL */
  screenshotUrl?: string;
  /** HTML URL */
  htmlUrl?: string;
}

export interface SnapshotViewerProps {
  /** 快照 ID */
  snapshotId: number;
  /** 原始 URL（备用显示） */
  originalUrl?: string;
  /** 最大高度 */
  maxHeight?: string;
  /** 是否显示元数据 */
  showMetadata?: boolean;
  /** 默认视图模式 */
  defaultViewMode?: ViewMode;
  /** 自定义类名 */
  className?: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

// 使用共享的 HTML 清理工具（DOMPurify），防止 XSS 注入
// 阅读模式专用：移除图片（防盗链）+ 剥离内联 style（让 .reading-prose CSS 类接管排版）
import { sanitizeHtmlForReading } from "@/lib/utils/html-sanitizer";

// ============================================================================
// 辅助组件
// ============================================================================

function MetadataItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string | number | null;
}) {
  if (!value) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
      <Icon className="size-3.5" />
      <span>{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

/**
 * 截图查看器组件
 */
function ScreenshotView({
  screenshotUrl,
  title,
  maxHeight,
}: {
  screenshotUrl: string;
  title?: string;
  maxHeight: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const handleResetZoom = () => setZoom(100);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (imageError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="size-12 text-destructive/50" />
        <p className="text-sm text-muted-foreground">截图加载失败</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 缩放控制栏 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            title="缩小"
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            title="放大"
          >
            <ZoomIn className="size-4" />
          </Button>
          {zoom !== 100 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="text-xs h-7 px-2"
            >
              重置
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleFullscreen}
          title="全屏查看"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>

      {/* 截图显示区域 */}
      <ScrollArea
        style={{ maxHeight }}
        className="border rounded-lg bg-muted/30"
      >
        <div
          className="p-4 flex justify-center"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={title || "页面截图"}
            className="max-w-full shadow-lg rounded"
            onError={() => setImageError(true)}
          />
        </div>
      </ScrollArea>

      {/* 全屏模态框 */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={toggleFullscreen}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={toggleFullscreen}
          >
            <span className="text-2xl">×</span>
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={title || "页面截图"}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function SnapshotViewer({
  snapshotId,
  originalUrl,
  maxHeight = "600px",
  showMetadata = true,
  defaultViewMode,
  className,
}: SnapshotViewerProps) {
  const [content, setContent] = useState<SnapshotContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode || "text");

  // 是否有截图
  const hasScreenshot = !!content?.screenshotUrl;

  // 处理后的 HTML 内容（移除图片标签以避免防盗链问题）
  const sanitizedContent = useMemo(() => {
    if (!content?.readableContent) return "";
    return sanitizeHtmlForReading(content.readableContent);
  }, [content?.readableContent]);

  // 加载快照内容
  const loadContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_SNAPSHOTS.content(String(snapshotId)));
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "加载快照失败");
      }

      setContent(result.data);

      // 如果有截图且未指定默认模式，自动切换到截图模式
      if (result.data?.screenshotUrl && !defaultViewMode) {
        setViewMode("screenshot");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [snapshotId, defaultViewMode]);

  // 初始加载
  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // 复制文本内容
  const handleCopyText = useCallback(async () => {
    if (!content?.readableTextContent) return;

    try {
      await navigator.clipboard.writeText(content.readableTextContent);
      setIsCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, [content]);

  // 格式化日期
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-6 w-3/4" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 space-y-4",
          className,
        )}
      >
        <AlertCircle className="size-12 text-destructive/50" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={loadContent}>
          <RefreshCw className="size-4 mr-1.5" />
          重试
        </Button>
      </div>
    );
  }

  // 无内容
  if (!content?.readableContent && !content?.screenshotUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 space-y-4",
          className,
        )}
      >
        <FileText className="size-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">快照内容为空</p>
      </div>
    );
  }

  // 正常显示
  return (
    <div className={cn("space-y-4", className)}>
      {/* 标题和操作栏 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {content.readableTitle && (
            <h2 className="text-lg font-semibold text-foreground line-clamp-2">
              {content.readableTitle}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 视图切换（仅在有截图时显示） */}
          {hasScreenshot && content.readableContent && (
            <div className="flex items-center border rounded-md mr-2">
              <Button
                variant={viewMode === "text" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("text")}
                title="文本视图"
                className="rounded-r-none"
              >
                <AlignLeft className="size-4" />
              </Button>
              <Button
                variant={viewMode === "screenshot" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setViewMode("screenshot")}
                title="截图视图"
                className="rounded-l-none"
              >
                <ImageIcon className="size-4" />
              </Button>
            </div>
          )}
          {viewMode === "text" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopyText}
              title="复制文本"
            >
              {isCopied ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          )}
          {(content.finalUrl || originalUrl) && (
            <Button variant="ghost" size="icon-sm" asChild title="打开原始链接">
              <a
                href={content.finalUrl || originalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* 元数据 */}
      {showMetadata && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <MetadataItem
            icon={User}
            label="作者"
            value={content.readableByline}
          />
          <MetadataItem
            icon={FileText}
            label="字数"
            value={
              content.readableWordCount
                ? `${content.readableWordCount.toLocaleString()}`
                : null
            }
          />
          <MetadataItem
            icon={Calendar}
            label="快照时间"
            value={formatDate(content.capturedAt)}
          />
          {content.snapshotType && (
            <MetadataItem
              icon={ImageIcon}
              label="类型"
              value={
                content.snapshotType === "full"
                  ? "完整快照"
                  : content.snapshotType === "standard"
                    ? "标准快照"
                    : "基础快照"
              }
            />
          )}
        </div>
      )}

      {/* 内容区域 */}
      {viewMode === "screenshot" && content.screenshotUrl ? (
        <ScreenshotView
          screenshotUrl={content.screenshotUrl}
          title={content.readableTitle || undefined}
          maxHeight={maxHeight}
        />
      ) : (
        <article
          className="reading-prose break-words"
          style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 导出
// ============================================================================

export default SnapshotViewer;
