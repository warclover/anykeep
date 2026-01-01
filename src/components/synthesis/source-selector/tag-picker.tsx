/**
 * 标签选择器组件
 *
 * 用于在综述创建时选择标签作为来源
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Tag, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TagPickerProps, SourceSelection, ContentStats } from "./types";

interface TagItem {
  name: string;
  count: number;
}

/**
 * 标签选择器
 */
export function TagPicker({
  onSelect,
  onCancel,
  disabled,
  initialTag,
}: TagPickerProps) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(
    initialTag || null,
  );
  const [previewStats, setPreviewStats] = useState<ContentStats | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // 加载用户标签列表
  useEffect(() => {
    async function loadTags() {
      try {
        // 使用热门标签 API，但获取更多数量
        const response = await fetch("/api/tags?limit=100");
        if (response.ok) {
          const result = await response.json();
          setTags(result.data || []);
        } else {
          // 如果没有专门的标签 API，使用 RPC
          // 这里暂时使用空数组，后续可以添加 API
          setTags([]);
        }
      } catch (error) {
        console.error("Failed to load tags:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTags();
  }, []);

  // 选择标签时加载预览统计
  useEffect(() => {
    if (!selectedTag) {
      setPreviewStats(null);
      return;
    }

    const tagToLoad = selectedTag; // 捕获当前值避免闭包问题

    async function loadPreview() {
      setIsLoadingPreview(true);
      try {
        const response = await fetch(
          `/api/synthesis/preview?sourceType=tag&sourceId=${encodeURIComponent(tagToLoad)}&pageSize=1`,
        );
        const result = await response.json();
        setPreviewStats(result.contentStats);
      } catch (error) {
        console.error("Failed to load preview:", error);
      } finally {
        setIsLoadingPreview(false);
      }
    }
    loadPreview();
  }, [selectedTag]);

  // 过滤标签
  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // 确认选择
  const handleConfirm = useCallback(() => {
    if (!selectedTag) return;

    const selection: SourceSelection = {
      sourceType: "tag",
      sourceId: selectedTag,
      sourceName: `#${selectedTag}`,
      bookmarkIds: [],
      excludedIds: [],
      contentStats: previewStats,
    };

    onSelect(selection);
  }, [selectedTag, previewStats, onSelect]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">选择标签</div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索标签..."
          className="pl-9"
          disabled={disabled}
        />
      </div>

      {/* 标签列表 */}
      <ScrollArea className="h-[250px] border rounded-lg p-3">
        {filteredTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Tag className="h-8 w-8 mb-2" />
            <p className="text-sm">
              {searchQuery ? "未找到匹配的标签" : "暂无标签"}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredTags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedTag(tag.name)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                  "border hover:bg-muted/50",
                  selectedTag === tag.name
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <Tag className="h-3 w-3" />
                <span>{tag.name}</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {tag.count}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 预览统计 */}
      {selectedTag && (
        <div className="rounded-lg border bg-muted/30 p-3">
          {isLoadingPreview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : previewStats ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">书签数量</span>
                <span className="font-medium">{previewStats.totalCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">有摘要</span>
                <span className="font-medium">
                  {previewStats.withSummary} / {previewStats.totalCount}
                </span>
              </div>
              {previewStats.totalCount < 3 && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ 书签数量较少，建议至少 3 篇以获得更好的综述效果
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={disabled}>
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={
            disabled ||
            !selectedTag ||
            isLoadingPreview ||
            (previewStats?.totalCount ?? 0) === 0
          }
        >
          确认选择
        </Button>
      </div>
    </div>
  );
}
