/**
 * 批量标签操作对话框
 * 支持批量添加/移除标签
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Tag, Plus, Minus, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBatchTags } from "@/hooks/batch/use-batch-tags";
import { useCustomUsageTags } from "@/hooks/data/use-custom-usage-tags";
import { USAGE_TAG_PRESETS } from "@/lib/constants/usage-tags";
import {
  BATCH_LIMITS,
  TAG_DIALOG_MODES,
  type TagDialogMode,
} from "./constants";
import type { Bookmark } from "@/types/supabase";
import type { BatchTagsResult } from "@/lib/batch/validation";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

export interface BatchTagDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 选中的书签 ID 列表 */
  selectedIds: number[];
  /** 选中的书签数据（用于分析现有标签） */
  selectedBookmarks: BookmarkWithFolder[];
  /** 操作成功回调 */
  onSuccess?: (result: BatchTagsResult) => void;
}

/**
 * 批量标签操作对话框
 */
export function BatchTagDialog({
  open,
  onOpenChange,
  selectedIds,
  selectedBookmarks,
  onSuccess,
}: BatchTagDialogProps) {
  // 当前模式
  const [mode, setMode] = useState<TagDialogMode>(TAG_DIALOG_MODES.ADD);

  // 输入的标签
  const [inputValue, setInputValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 自定义标签
  const { customTags } = useCustomUsageTags();

  // 批量操作 Hook
  const { batchAddTags, batchRemoveTags, isProcessing } = useBatchTags({
    onSuccess: (result) => {
      onSuccess?.(result);
      onOpenChange(false);
      // 清空状态
      setSelectedTags([]);
      setInputValue("");
    },
  });

  // 分析选中书签的现有标签
  const existingTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    selectedBookmarks.forEach((bookmark) => {
      const tags = [...(bookmark.ai_tags || []), ...(bookmark.user_tags || [])];
      tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [selectedBookmarks]);

  // 推荐标签（预设 + 自定义）
  const recommendedTags = useMemo(() => {
    const presetTagNames = USAGE_TAG_PRESETS.map((t) => t.label);
    const customTagNames = customTags.map((t) => t.label || t.name || t.value);
    return [...new Set([...presetTagNames, ...customTagNames])];
  }, [customTags]);

  // 添加标签
  const handleAddTag = useCallback(
    (tag: string) => {
      const trimmedTag = tag.trim();
      if (!trimmedTag) return;
      if (trimmedTag.length > BATCH_LIMITS.TAG_MAX_LENGTH) return;
      if (selectedTags.length >= BATCH_LIMITS.MAX_TAGS) return;
      if (selectedTags.includes(trimmedTag)) return;

      setSelectedTags((prev) => [...prev, trimmedTag]);
      setInputValue("");
    },
    [selectedTags],
  );

  // 移除标签
  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // 处理输入框回车
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag(inputValue);
      }
    },
    [inputValue, handleAddTag],
  );

  // 执行批量操作
  const handleSubmit = useCallback(async () => {
    if (selectedTags.length === 0) return;

    if (mode === TAG_DIALOG_MODES.ADD) {
      await batchAddTags(selectedIds, selectedTags);
    } else {
      await batchRemoveTags(selectedIds, selectedTags);
    }
  }, [mode, selectedIds, selectedTags, batchAddTags, batchRemoveTags]);

  // 对话框打开状态变更处理（关闭时清空状态）
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // 关闭时清空状态
        setSelectedTags([]);
        setInputValue("");
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-500" />
            批量标签操作
          </DialogTitle>
          <DialogDescription>
            为 {selectedIds.length} 个书签批量添加或移除标签
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as TagDialogMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value={TAG_DIALOG_MODES.ADD} className="gap-1">
              <Plus className="h-4 w-4" />
              添加标签
            </TabsTrigger>
            <TabsTrigger value={TAG_DIALOG_MODES.REMOVE} className="gap-1">
              <Minus className="h-4 w-4" />
              移除标签
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAG_DIALOG_MODES.ADD} className="space-y-4">
            {/* 标签输入 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">输入标签</label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入标签名称，回车添加"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  disabled={isProcessing}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleAddTag(inputValue)}
                  disabled={!inputValue.trim() || isProcessing}
                >
                  添加
                </Button>
              </div>
            </div>

            {/* 推荐标签 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">
                推荐标签
              </label>
              <div className="flex flex-wrap gap-2">
                {recommendedTags.slice(0, 10).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={() => handleAddTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value={TAG_DIALOG_MODES.REMOVE} className="space-y-4">
            {/* 选中书签的现有标签 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                现有标签（点击选择要移除的标签）
              </label>
              {existingTags.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
                  {existingTags.map(({ tag, count }) => (
                    <Badge
                      key={tag}
                      variant={
                        selectedTags.includes(tag) ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        selectedTags.includes(tag)
                          ? handleRemoveTag(tag)
                          : handleAddTag(tag)
                      }
                    >
                      {tag}
                      <span className="ml-1 text-xs opacity-60">({count})</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">选中的书签暂无标签</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* 已选择的标签 */}
        {selectedTags.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">
              待{mode === TAG_DIALOG_MODES.ADD ? "添加" : "移除"}的标签
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={
                    mode === TAG_DIALOG_MODES.ADD ? "default" : "destructive"
                  }
                  className="gap-1"
                >
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer hover:opacity-70"
                    onClick={() => handleRemoveTag(tag)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedTags.length === 0 || isProcessing}
            variant={
              mode === TAG_DIALOG_MODES.REMOVE ? "destructive" : "default"
            }
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              <>{mode === TAG_DIALOG_MODES.ADD ? "添加标签" : "移除标签"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
