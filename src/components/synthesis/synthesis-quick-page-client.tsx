/**
 * 内容分析快速创建页客户端组件
 *
 * 单页完成书签选择和分析配置，简化原有 4 步流程
 *
 * 设计原则：
 * - 单页完成：选择书签 → 开始分析
 * - 默认配置：深度=标准，风格=叙事
 * - 高级设置折叠：需要时再展开
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Loader2,
  CheckSquare,
  Square,
  ExternalLink,
  Lightbulb,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { SynthesisDepthMode, SynthesisOutputStyle } from "@/lib/synthesis";
import { AdvancedSettingsPanel } from "./advanced-settings-panel";
import { clientLogger } from "@/lib/client-logger";

// 书签类型
interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  ai_summary: string | null;
  created_at: string;
  folder_name: string | null;
}

// 平台显示名称映射
const PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信",
  bilibili: "B站",
  zhihu: "知乎",
  weibo: "微博",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  youtube: "YouTube",
  unknown: "其他",
};

/**
 * 获取平台显示名称
 */
function getPlatformLabel(platform: string | null): string {
  return PLATFORM_LABELS[platform || "unknown"] || platform || "其他";
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "刚刚";
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}月前`;
}

/**
 * 内容分析快速创建页
 */
export function SynthesisQuickPageClient() {
  const router = useRouter();

  // 书签列表状态
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 配置状态（默认值）
  const [depthMode, setDepthMode] = useState<SynthesisDepthMode>("standard");
  const [outputStyle, setOutputStyle] =
    useState<SynthesisOutputStyle>("narrative");

  // 创建状态
  const [isCreating, setIsCreating] = useState(false);

  // 每页数量
  const PAGE_SIZE = 20;

  // 加载书签列表
  const loadBookmarks = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((pageNum - 1) * PAGE_SIZE),
          excludeBrowser: "true", // 排除浏览器书签
        });

        if (searchQuery) {
          params.append("keyword", searchQuery);
        }

        const response = await fetch(`/api/bookmarks?${params}`);
        if (response.ok) {
          const result = await response.json();
          const newBookmarks = result.data?.bookmarks || [];

          if (append) {
            setBookmarks((prev) => [...prev, ...newBookmarks]);
          } else {
            setBookmarks(newBookmarks);
          }

          setHasMore(result.data?.pagination?.hasMore ?? false);
        }
      } catch (error) {
        clientLogger.error({ error }, "Failed to load bookmarks:");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [searchQuery],
  );

  // 初始加载
  useEffect(() => {
    loadBookmarks(1);
  }, [loadBookmarks]);

  // 搜索时重置
  useEffect(() => {
    setPage(1);
    loadBookmarks(1);
  }, [searchQuery, loadBookmarks]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadBookmarks(nextPage, true);
  }, [page, loadBookmarks]);

  // 切换选择
  const toggleSelection = useCallback((bookmarkId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookmarkId)) {
        next.delete(bookmarkId);
      } else {
        next.add(bookmarkId);
      }
      return next;
    });
  }, []);

  // 计算选中数量
  const selectedCount = selectedIds.size;

  // 是否可以开始分析（至少选择 2 篇，与后端 MIN_BOOKMARKS_COUNT 保持一致）
  const canStartAnalysis = selectedCount >= 2;

  // 处理创建分析
  const handleStartAnalysis = useCallback(async () => {
    if (!canStartAnalysis) return;

    setIsCreating(true);

    try {
      const requestBody = {
        sourceType: "selection",
        depthMode,
        outputStyle,
        bookmarkIds: Array.from(selectedIds),
      };

      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("创建失败");
      }

      const { data } = await response.json();
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      clientLogger.error({ error }, "Create synthesis error:");
    } finally {
      setIsCreating(false);
    }
  }, [canStartAnalysis, depthMode, outputStyle, selectedIds, router]);

  // 按钮文案
  const buttonText = useMemo(() => {
    if (isCreating) return "创建中...";
    if (selectedCount === 0) return "请选择内容";
    if (selectedCount < 2) return "至少选择 2 篇";
    return "开始分析";
  }, [isCreating, selectedCount]);

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4 px-4 md:px-8 py-4 border-b bg-background">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/synthesis">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">收藏内容对比分析</h1>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 md:px-8 py-4 space-y-4">
        {/* 使用说明 */}
        <Alert className="bg-muted/50 border-muted">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            选择 2 篇以上内容，AI 将分析它们的共识、分歧与知识盲区
          </AlertDescription>
        </Alert>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索书签..."
            className="pl-9"
          />
        </div>

        {/* 书签列表 */}
        <ScrollArea className="flex-1 border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {searchQuery ? "未找到匹配的书签" : "暂无书签"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {bookmarks.map((bookmark) => {
                const isSelected = selectedIds.has(bookmark.id);
                return (
                  <button
                    key={bookmark.id}
                    type="button"
                    onClick={() => toggleSelection(bookmark.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 text-left transition-colors",
                      "hover:bg-muted/50",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {bookmark.title}
                        </span>
                        <a
                          href={bookmark.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getPlatformLabel(bookmark.platform)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(bookmark.created_at)}
                        </span>
                        {bookmark.folder_name && (
                          <span className="text-xs text-muted-foreground truncate">
                            · {bookmark.folder_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* 加载更多 */}
              {hasMore && (
                <div className="p-3 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      "加载更多"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 底部操作栏 */}
      <div className="border-t bg-background px-4 md:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              已选{" "}
              <span className="font-medium text-foreground">
                {selectedCount}
              </span>{" "}
              篇
            </span>

            {/* 高级设置 */}
            <AdvancedSettingsPanel
              depthMode={depthMode}
              outputStyle={outputStyle}
              onDepthModeChange={setDepthMode}
              onOutputStyleChange={setOutputStyle}
              disabled={isCreating}
            />
          </div>

          <Button
            onClick={handleStartAnalysis}
            disabled={!canStartAnalysis || isCreating}
            className="gap-2"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
