/**
 * 来源书签面板组件
 *
 * 显示被综述的所有书签列表，支持折叠展开和跳转
 *
 * @version 1.0.0
 * @since 2026-01-01 [E4]
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Loader2,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SynthesisSourceType } from "@/lib/synthesis";
import { clientLogger } from "@/lib/client-logger";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";

interface SourceBookmark {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  ai_summary: string | null;
  created_at: string;
}

interface SourceBookmarksPanelProps {
  reportId: string;
  sourceType: SynthesisSourceType;
  sourceId: string | null;
  sourceBookmarkIds: string[] | null;
  sourceCount: number;
  defaultOpen?: boolean;
}

/**
 * 平台显示名称映射
 */
const PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信",
  bilibili: "B站",
  zhihu: "知乎",
  weibo: "微博",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  youtube: "YouTube",
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
  unknown: "其他",
};

/**
 * 来源书签面板
 */
export function SourceBookmarksPanel({
  reportId: _reportId, // 预留用于未来按报告ID查询
  sourceType,
  sourceId,
  sourceBookmarkIds,
  sourceCount,
  defaultOpen = false,
}: SourceBookmarksPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [bookmarks, setBookmarks] = useState<SourceBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 加载书签列表
  const loadBookmarks = useCallback(async () => {
    setIsLoading(true);
    try {
      // 根据来源类型构建查询参数
      const params = new URLSearchParams({
        sourceType,
        pageSize: "100",
      });

      if (sourceId) {
        params.append("sourceId", sourceId);
      }

      if (sourceBookmarkIds && sourceBookmarkIds.length > 0) {
        params.append("bookmarkIds", sourceBookmarkIds.join(","));
      }

      const response = await fetch(`${API_SYNTHESIS.preview}?${params}`);
      if (response.ok) {
        const result = await response.json();
        setBookmarks(result.bookmarks || []);
      }
    } catch (error) {
      clientLogger.error({ error }, "Failed to load source bookmarks:");
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, [sourceType, sourceId, sourceBookmarkIds]);

  // 懒加载：只在展开时加载书签列表
  useEffect(() => {
    if (isOpen && !isLoaded && !isLoading) {
      loadBookmarks();
    }
  }, [isOpen, isLoaded, isLoading, loadBookmarks]);

  const getPlatformLabel = (platform: string | null): string => {
    return PLATFORM_LABELS[platform || "unknown"] || platform || "其他";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <BookOpen className="h-5 w-5 text-indigo-500" />
              来源书签
              <Badge variant="secondary" className="ml-2">
                {sourceCount}
              </Badge>
            </CardTitle>
            <CardDescription>
              本综述基于以下 {sourceCount} 篇书签生成
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  加载中...
                </span>
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无书签数据</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="divide-y">
                  {bookmarks.map((bookmark) => (
                    <SourceBookmarkItem
                      key={bookmark.id}
                      bookmark={bookmark}
                      getPlatformLabel={getPlatformLabel}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * 单个来源书签项
 */
function SourceBookmarkItem({
  bookmark,
  getPlatformLabel,
}: {
  bookmark: SourceBookmark;
  getPlatformLabel: (platform: string | null) => string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 hover:bg-muted/30 transition-colors px-1 rounded">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/bookmarks/${bookmark.id}`}
                  className="font-medium text-sm hover:text-primary truncate block"
                >
                  {bookmark.title}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{bookmark.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  点击查看书签详情
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {getPlatformLabel(bookmark.platform)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(bookmark.created_at).toLocaleDateString()}
          </span>
        </div>

        {bookmark.ai_summary && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
            {bookmark.ai_summary}
          </p>
        )}
      </div>
    </div>
  );
}
