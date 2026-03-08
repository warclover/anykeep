/**
 * 盲区补充对话框
 *
 * 点击盲区关键词时打开，支持：
 * - 显示盲区主题和建议
 * - 提供搜索关键词复制功能
 * - 快速收藏 URL
 * - 收藏后提示重新生成综述
 *
 * @version 1.0.0
 * @since 2026-01-01 [E3]
 */

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { API_BOOKMARKS } from "@/lib/constants/api-paths";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Lightbulb,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Loader2,
  BookmarkPlus,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import type { BlindSpot } from "@/lib/synthesis";

// ============================================================================
// 类型定义
// ============================================================================

interface BlindSpotSupplementDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 盲区数据 */
  blindSpot: BlindSpot;
  /** 综述报告 ID */
  reportId: string;
  /** 重新生成综述的回调 */
  onRegenerate?: () => void;
}

interface MetadataResult {
  title?: string;
  description?: string;
  platform?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

export function BlindSpotSupplementDialog({
  open,
  onOpenChange,
  blindSpot,
  reportId,
  onRegenerate,
}: BlindSpotSupplementDialogProps) {
  // reportId 用于将补充的书签关联到综述报告，便于追踪来源
  // 在创建书签时会作为 metadata 传递（预留接口）
  const _synthesisReportId = reportId;
  void _synthesisReportId; // 标记为已使用，后续集成时启用
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // 重置状态
  const resetState = useCallback(() => {
    setUrl("");
    setTitle("");
    setIsCreated(false);
    setIsFetchingMetadata(false);
    setIsCreating(false);
    setCopiedKeyword(null);
  }, []);

  // 关闭对话框
  const handleClose = useCallback(() => {
    onOpenChange(false);
    // 延迟重置状态，等待动画完成
    setTimeout(resetState, 200);
  }, [onOpenChange, resetState]);

  // 复制关键词
  const handleCopyKeyword = useCallback(async (keyword: string) => {
    try {
      await navigator.clipboard.writeText(keyword);
      setCopiedKeyword(keyword);
      toast.success(`已复制关键词: ${keyword}`);
      setTimeout(() => setCopiedKeyword(null), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, []);

  // 在新标签页中搜索（使用必应搜索，兼容国内网络环境）
  const handleSearchInBrowser = useCallback((keyword: string) => {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}`;
    window.open(searchUrl, "_blank");
  }, []);

  // 获取 URL 元数据
  const fetchMetadata = useCallback(async (inputUrl: string) => {
    if (!inputUrl.trim()) return;

    // 验证 URL 格式
    try {
      new URL(inputUrl);
    } catch {
      toast.error("请输入有效的 URL");
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const response = await fetch(API_BOOKMARKS.metadata, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (response.ok) {
        const data = (await response.json()) as { data: MetadataResult };
        if (data.data?.title) {
          setTitle(data.data.title);
        }
      }
    } catch (error) {
      // 元数据获取失败不阻塞收藏流程，但记录日志便于监控
      logger.warn(
        { error, url: inputUrl },
        "Metadata fetch failed, continuing without metadata",
      );
    } finally {
      setIsFetchingMetadata(false);
    }
  }, []);

  // URL 输入失焦时获取元数据
  const handleUrlBlur = useCallback(() => {
    if (url && !title) {
      fetchMetadata(url);
    }
  }, [url, title, fetchMetadata]);

  // 创建书签
  const handleCreateBookmark = useCallback(async () => {
    if (!url.trim()) {
      toast.error("请输入 URL");
      return;
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      toast.error("请输入有效的 URL");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(API_BOOKMARKS.legacyList, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          // 使用盲区关键词作为标签
          userTags: blindSpot.search_keywords.slice(0, 3),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "收藏失败");
      }

      setIsCreated(true);
      toast.success("收藏成功！");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "收藏失败");
    } finally {
      setIsCreating(false);
    }
  }, [url, title, blindSpot.search_keywords]);

  // 重新生成综述
  const handleRegenerate = useCallback(() => {
    handleClose();
    onRegenerate?.();
  }, [handleClose, onRegenerate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-purple-500" />
            补充知识盲区
          </DialogTitle>
          <DialogDescription>
            发现与主题相关但尚未收藏的内容，一键补充到您的收藏中
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 盲区信息 */}
          <div className="rounded-lg border bg-purple-50/50 p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">盲区主题</Label>
              <p className="font-medium text-sm">{blindSpot.topic}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">建议方向</Label>
              <p className="text-sm text-muted-foreground">
                {blindSpot.suggestion}
              </p>
            </div>
          </div>

          {/* 搜索关键词 */}
          {blindSpot.search_keywords.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                建议搜索关键词（点击复制或搜索）
              </Label>
              <div className="flex flex-wrap gap-2">
                {blindSpot.search_keywords.map((keyword, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-purple-100 transition-colors group py-1.5 px-3"
                    onClick={() => handleCopyKeyword(keyword)}
                  >
                    {copiedKeyword === keyword ? (
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1 opacity-50 group-hover:opacity-100" />
                    )}
                    {keyword}
                    <button
                      className="ml-2 p-0.5 rounded hover:bg-purple-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSearchInBrowser(keyword);
                      }}
                      title="在浏览器中搜索"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 收藏成功后的提示 */}
          {isCreated ? (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-5 w-5" />
                <span className="font-medium">收藏成功！</span>
              </div>
              <p className="text-sm text-green-600">
                新内容已添加到您的收藏。建议重新生成综述以包含这些新知识。
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreated(false);
                    setUrl("");
                    setTitle("");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  继续添加
                </Button>
                {onRegenerate && (
                  <Button size="sm" onClick={handleRegenerate}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    重新生成综述
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* 快速收藏表单 */
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookmarkPlus className="h-4 w-4 text-primary" />
                快速收藏
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    placeholder="粘贴搜索到的网页链接..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    disabled={isCreating}
                  />
                  {isFetchingMetadata && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">
                  标题{" "}
                  <span className="text-muted-foreground font-normal">
                    (可选)
                  </span>
                </Label>
                <Input
                  id="title"
                  placeholder="自动获取或手动输入..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCreateBookmark}
                disabled={!url.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在收藏...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    一键收藏
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
