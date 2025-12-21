/**
 * 微信文章阅读器组件
 *
 * @module wechat-article
 * @description 微信公众号文章完整内容展示组件
 *
 * Phase 4 升级：阅读器增强
 * - 字体大小调节
 * - 阅读主题切换
 * - 目录导航
 * - 阅读进度显示
 * - 复制全文功能
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  BookOpen,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  MoreHorizontal,
  Download,
  FileDown,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWechatArticle } from "./hooks/use-wechat-article";
import { useWechatArticleCrawl } from "./hooks/use-wechat-article-crawl";
import { useReaderSettings } from "./hooks/use-reader-settings";
import { useReadingProgress } from "./hooks/use-reading-progress";
import { useToc } from "./hooks/use-toc";
import { useStylePreferences } from "./hooks/use-style-preferences";
import { WechatArticleImages } from "./wechat-article-images";
import { WechatArticleStatus } from "./wechat-article-status";
import { ReaderToolbar } from "./reader-toolbar";
import { StyleSelector } from "./style-selector";

// =============================================================================
// 类型定义
// =============================================================================

export interface WechatArticleViewerProps {
  /** 快照 ID */
  snapshotId: number;
  /** 书签 ID（用于关联操作） */
  bookmarkId: number;
  /** 原始 URL */
  originalUrl: string;
  /** 是否自动抓取（首次访问时） */
  autoFetch?: boolean;
  /** 最大高度 */
  maxHeight?: string;
  /** 自定义类名 */
  className?: string;
  /** 删除成功回调 */
  onDeleted?: () => void;
}

type ViewMode = "article" | "markdown" | "images";

// =============================================================================
// 组件实现
// =============================================================================

/**
 * 微信文章阅读器
 *
 * 功能：
 * - 显示完整文章内容（HTML/Markdown 切换）
 * - 图片画廊模式
 * - 重新获取功能
 * - 抓取状态反馈
 */
export function WechatArticleViewer({
  snapshotId,
  bookmarkId: _bookmarkId,
  originalUrl,
  autoFetch = false,
  maxHeight,
  className,
  onDeleted,
}: WechatArticleViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("article");
  const [isDeleting, setIsDeleting] = useState(false);
  const hasAutoFetchedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 数据获取
  const {
    data: article,
    isLoading,
    error: _error,
    mutate,
  } = useWechatArticle(snapshotId);

  // 抓取操作
  const { crawl, refetch, isCrawling, progress } = useWechatArticleCrawl(
    snapshotId,
    {
      onSuccess: () => mutate(),
    },
  );

  // Phase 4 升级：阅读器增强
  const {
    settings: readerSettings,
    setFontSize,
    setTheme,
    getContentStyle,
  } = useReaderSettings();

  // Phase 4 升级：阅读进度
  const { progress: readingProgress } = useReadingProgress({
    containerRef: contentRef,
  });

  // Phase 4 升级：目录导航
  const { items: tocItems, scrollToHeading } = useToc(article?.html);

  // 样式选项升级：用户偏好
  const {
    styleLevel,
    setStyleLevel,
    preferences,
    setRememberChoice,
  } = useStylePreferences();

  // 首次自动抓取（使用用户偏好的 styleLevel）
  useEffect(() => {
    if (
      autoFetch &&
      !hasAutoFetchedRef.current &&
      !article?.html &&
      !isLoading &&
      !isCrawling
    ) {
      hasAutoFetchedRef.current = true;
      crawl({ styleLevel });
    }
  }, [autoFetch, article, isLoading, isCrawling, crawl, styleLevel]);

  // 打开原始链接
  const handleOpenOriginal = useCallback(() => {
    window.open(originalUrl, "_blank", "noopener,noreferrer");
  }, [originalUrl]);

  // Phase 4 升级：复制全文
  const handleCopyText = useCallback(() => {
    if (!article?.markdown && !article?.html) return;

    // 优先使用 markdown，否则从 HTML 提取纯文本
    let textToCopy = article.markdown;
    if (!textToCopy && article.html) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = article.html;
      textToCopy = tempDiv.textContent || tempDiv.innerText || "";
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).catch(console.error);
    }
  }, [article]);

  // Phase 6 升级：导出处理
  const handleExport = useCallback(
    (format: "markdown" | "pdf") => {
      const url = `/api/wechat-article/${snapshotId}/export?format=${format}`;
      window.open(url, "_blank");
    },
    [snapshotId],
  );

  // 删除快照
  const handleDelete = useCallback(async () => {
    if (isDeleting) return;

    // 确认删除
    const confirmed = window.confirm(
      "确定要删除快照吗？删除后可重新获取以更新排版样式。",
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/snapshots/${snapshotId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || "删除失败");
      }

      // 通知父组件
      onDeleted?.();
    } catch (err) {
      console.error("[WechatArticleViewer] Delete failed:", err);
      alert(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  }, [snapshotId, isDeleting, onDeleted]);

  // ==========================================================================
  // 加载状态
  // ==========================================================================

  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ==========================================================================
  // 无内容状态
  // ==========================================================================

  if (!article?.html) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">微信文章</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenOriginal}
              className="text-xs"
            >
              <ExternalLink className="size-3 mr-1" />
              原文
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <BookOpen className="size-12 text-muted-foreground/50" />
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                文章完整内容尚未抓取
              </p>
              {/* 样式选项升级：抓取前选择样式级别 */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <StyleSelector
                  value={styleLevel}
                  onChange={setStyleLevel}
                  rememberChoice={preferences.rememberChoice}
                  onRememberChoiceChange={setRememberChoice}
                  disabled={isCrawling}
                />
              </div>
              <Button onClick={() => crawl({ styleLevel })} disabled={isCrawling} size="sm">
                {isCrawling ? (
                  <>
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    抓取中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 size-4" />
                    立即抓取
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 抓取进度 */}
          {isCrawling && progress && (
            <WechatArticleStatus progress={progress} />
          )}
        </CardContent>
      </Card>
    );
  }

  // ==========================================================================
  // 正常内容展示
  // ==========================================================================

  const hasImages = article.images && article.images.length > 0;
  const hasMarkdown = !!article.markdown;
  const failedImages =
    article.images?.filter((i) => i.status === "failed").length || 0;

  return (
    <Card className={cn("w-full", className)}>
      {/* 工具栏 */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          {/* 视图切换 */}
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "article" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("article")}
              className="h-8"
            >
              <FileText className="size-4 mr-1" />
              文章
            </Button>

            {hasMarkdown && (
              <Button
                variant={viewMode === "markdown" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("markdown")}
                className="h-8"
              >
                <BookOpen className="size-4 mr-1" />
                阅读
              </Button>
            )}

            {hasImages && (
              <Button
                variant={viewMode === "images" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("images")}
                className="h-8"
              >
                <ImageIcon className="size-4 mr-1" />
                图片 ({article.images.length})
              </Button>
            )}
          </div>

          {/* 操作菜单 */}
          <div className="flex items-center gap-1">
            {/* 样式选项升级：已有内容时显示当前样式级别 */}
            <StyleSelector
              value={article.styleLevel || styleLevel}
              onChange={setStyleLevel}
              rememberChoice={preferences.rememberChoice}
              onRememberChoiceChange={setRememberChoice}
              disabled={isCrawling}
            />

            {/* Phase 4 升级：阅读器工具栏 */}
            {(viewMode === "article" || viewMode === "markdown") && (
              <ReaderToolbar
                settings={readerSettings}
                onFontSizeChange={setFontSize}
                onThemeChange={setTheme}
                tocItems={tocItems}
                onTocClick={scrollToHeading}
                progress={readingProgress}
                onCopyText={handleCopyText}
              />
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenOriginal}
              className="h-8"
            >
              <ExternalLink className="size-3 mr-1" />
              原文
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => refetch({ redownloadImages: true, styleLevel })}
                  disabled={isCrawling}
                >
                  <RefreshCw className="size-4 mr-2" />
                  重新获取
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => refetch({ imagesOnly: true, styleLevel })}
                  disabled={isCrawling}
                >
                  <ImageIcon className="size-4 mr-2" />
                  仅更新图片
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Phase 6 升级：导出功能 */}
                <DropdownMenuItem onClick={() => handleExport("markdown")}>
                  <Download className="size-4 mr-2" />
                  导出 Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileDown className="size-4 mr-2" />
                  导出 PDF
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* 删除快照 */}
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="size-4 mr-2" />
                  {isDeleting ? "删除中..." : "删除快照"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {/* 内容区 */}
      <CardContent className="p-0">
        {maxHeight ? (
          <ScrollArea className="px-6" style={{ maxHeight }}>
            <div ref={contentRef}>
              {/* 文章视图 */}
              {viewMode === "article" && (
                <article
                  className="prose prose-sm dark:prose-invert max-w-none py-4"
                  style={getContentStyle()}
                  dangerouslySetInnerHTML={{ __html: article.html }}
                />
              )}

              {/* Markdown 视图 */}
              {viewMode === "markdown" && article.markdown && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none py-4 whitespace-pre-wrap"
                  style={getContentStyle()}
                >
                  {article.markdown}
                </div>
              )}

              {/* 图片画廊 */}
              {viewMode === "images" && hasImages && (
                <WechatArticleImages images={article.images} className="py-4" />
              )}
            </div>
          </ScrollArea>
        ) : (
          <div ref={contentRef} className="px-6">
            {/* 文章视图 - 无高度限制 */}
            {viewMode === "article" && (
              <article
                className="prose prose-sm dark:prose-invert max-w-none py-4"
                style={getContentStyle()}
                dangerouslySetInnerHTML={{ __html: article.html }}
              />
            )}

            {/* Markdown 视图 */}
            {viewMode === "markdown" && article.markdown && (
              <div
                className="prose prose-sm dark:prose-invert max-w-none py-4 whitespace-pre-wrap"
                style={getContentStyle()}
              >
                {article.markdown}
              </div>
            )}

            {/* 图片画廊 */}
            {viewMode === "images" && hasImages && (
              <WechatArticleImages images={article.images} className="py-4" />
            )}
          </div>
        )}
      </CardContent>

      {/* 元信息 */}
      <div className="border-t px-6 py-3 text-xs text-muted-foreground flex items-center gap-4">
        <span>{article.wordCount.toLocaleString()} 字</span>
        {hasImages && <span>{article.images.length} 张图片</span>}
        {failedImages > 0 && (
          <span className="text-yellow-600">{failedImages} 张图片加载失败</span>
        )}
      </div>
    </Card>
  );
}

export default WechatArticleViewer;
