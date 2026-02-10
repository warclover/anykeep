/**
 * 重复内容 Tab 组件
 *
 * 支持单组操作和跨组批量操作：
 * - 单组：RadioGroup 选择保留项 → 「保留选中，删除其他」
 * - 批量：Checkbox 选中多组 → 「批量清理」（按 AI 推荐自动保留）
 */

"use client";

import { useState, useCallback } from "react";
import {
  Copy,
  Trash2,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { useDuplicates, useHealthFix } from "@/hooks/domain/health";
import type { DuplicateGroup } from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// 文本常量
// ============================================

const TAB_TEXT = {
  empty: {
    title: "没有重复内容",
    description: "未发现重复的书签",
  },
  actions: {
    keepSelected: "保留选中，删除其他",
    ignoreGroup: "忽略此组",
    selectAll: "全选",
    deselectAll: "取消全选",
    batchCleanup: "批量清理",
    batchIgnore: "批量忽略",
  },
  batch: {
    selectedCount: (n: number, total: number) => `已选 ${n} / ${total} 组`,
    processing: (done: number, total: number) => `处理中 ${done}/${total}...`,
    successResult: (success: number, failed: number) => {
      if (failed === 0) return `已清理 ${success} 组重复内容`;
      return `已清理 ${success} 组，${failed} 组失败`;
    },
    confirmTip: "将按 AI 推荐自动保留最佳项，删除其他重复项",
  },
  matchTypes: {
    exact_url: "完全相同",
    normalized_url: "URL 相似",
    semantic: "语义相似",
  } as Record<string, string>,
};

// ============================================
// 重复组组件
// ============================================

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  checked: boolean;
  onCheck: (groupId: string, checked: boolean) => void;
  onAction: (action: string, params: Record<string, unknown>) => Promise<void>;
}

function DuplicateGroupCard({
  group,
  checked,
  onCheck,
  onAction,
}: DuplicateGroupCardProps) {
  const [selectedKeepId, setSelectedKeepId] = useState<string>(
    group.recommendedKeepId?.toString() || "",
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const matchLabel = TAB_TEXT.matchTypes[group.matchType] || group.matchType;

  const handleKeepOne = async () => {
    if (!selectedKeepId) {
      toast.error("请先选择要保留的项目");
      return;
    }

    const selectedIdNum = parseInt(selectedKeepId, 10);
    const deleteIds = group.items
      .filter(
        (item) => item.bookmarkId !== null && item.bookmarkId !== selectedIdNum,
      )
      .map((item) => item.bookmarkId as number);

    if (deleteIds.length === 0) {
      toast.error("没有需要删除的项目");
      return;
    }

    setIsProcessing(true);
    try {
      await onAction("keep_one", {
        keepBookmarkId: selectedIdNum,
        deleteBookmarkIds: deleteIds,
      });
      toast.success("已清理重复内容");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIgnore = async () => {
    setIsProcessing(true);
    try {
      await onAction("ignore_group", { groupId: group.id });
      toast.success("已忽略此组");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Checkbox
              checked={checked}
              onCheckedChange={(val) => onCheck(group.id, val as boolean)}
              aria-label={`选中第 ${group.id} 组`}
            />
            <Copy className="h-4 w-4 text-orange-500" />
            {group.items.length} 个重复项
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{matchLabel}</Badge>
            {group.similarity && (
              <Badge variant="secondary">
                相似度 {Math.round(group.similarity * 100)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={selectedKeepId} onValueChange={setSelectedKeepId}>
          {group.items.map((item) => (
            <div
              key={item.bookmarkId?.toString() || "unknown"}
              className="flex items-start gap-3 p-3 border rounded-lg"
            >
              <RadioGroupItem
                value={item.bookmarkId?.toString() || ""}
                id={`keep-${item.bookmarkId}`}
              />
              <Label
                htmlFor={`keep-${item.bookmarkId}`}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {item.title || "无标题"}
                  </span>
                  {item.isRecommendedKeep && (
                    <Badge variant="default" className="text-xs">
                      推荐保留
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {item.url}
                </p>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>
                    创建：{new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                  {item.folderName && <span>文件夹：{item.folderName}</span>}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleIgnore}
            disabled={isProcessing}
          >
            <EyeOff className="mr-1 h-4 w-4" />
            {TAB_TEXT.actions.ignoreGroup}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleKeepOne}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            {TAB_TEXT.actions.keepSelected}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// 主组件
// ============================================

interface DuplicatesTabProps {
  onUpdate: () => void;
}

export function DuplicatesTab({ onUpdate }: DuplicatesTabProps) {
  const [page, setPage] = useState(1);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  const { groups, totalGroups, isLoading, error, refresh } =
    useDuplicates(page);
  const { fixDuplicates } = useHealthFix();

  // 单组操作
  const handleAction = async (
    action: string,
    params: Record<string, unknown>,
  ) => {
    await fixDuplicates(
      action,
      params as {
        groupId?: string;
        keepBookmarkId?: number | null;
        deleteBookmarkIds?: number[];
      },
    );
    refresh();
    onUpdate();
  };

  // Checkbox 选中/取消
  const handleCheck = useCallback((groupId: string, checked: boolean) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(groupId);
      } else {
        next.delete(groupId);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedGroupIds.size === groups.length) {
      setSelectedGroupIds(new Set());
    } else {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)));
    }
  }, [selectedGroupIds.size, groups]);

  // 批量清理：对选中的���按 AI 推荐逐组执行 keep_one
  const handleBatchCleanup = useCallback(async () => {
    const targetGroups = groups.filter((g) => selectedGroupIds.has(g.id));
    if (targetGroups.length === 0) {
      toast.error("请先选择要处理的组");
      return;
    }

    // 检查是否所有组都有推荐保留项
    const noRecommend = targetGroups.filter((g) => !g.recommendedKeepId);
    if (noRecommend.length > 0) {
      toast.error(`${noRecommend.length} 组缺少 AI 推荐，请手动处理这些组`);
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress({ done: 0, total: targetGroups.length });

    let successCount = 0;
    let failCount = 0;

    for (const group of targetGroups) {
      const keepId = group.recommendedKeepId!;
      const deleteIds = group.items
        .filter(
          (item) => item.bookmarkId !== null && item.bookmarkId !== keepId,
        )
        .map((item) => item.bookmarkId as number);

      if (deleteIds.length === 0) {
        successCount++;
        setBatchProgress((prev) => ({ ...prev, done: prev.done + 1 }));
        continue;
      }

      try {
        await fixDuplicates("keep_one", {
          keepBookmarkId: keepId,
          deleteBookmarkIds: deleteIds,
        });
        successCount++;
      } catch {
        failCount++;
      }

      setBatchProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setIsBatchProcessing(false);
    setSelectedGroupIds(new Set());
    refresh();
    onUpdate();

    const message = TAB_TEXT.batch.successResult(successCount, failCount);
    if (failCount === 0) {
      toast.success(message);
    } else {
      toast.warning(message);
    }
  }, [groups, selectedGroupIds, fixDuplicates, refresh, onUpdate]);

  // 批量忽略
  const handleBatchIgnore = useCallback(async () => {
    const targetGroups = groups.filter((g) => selectedGroupIds.has(g.id));
    if (targetGroups.length === 0) {
      toast.error("请先选择要忽略的组");
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress({ done: 0, total: targetGroups.length });

    let successCount = 0;
    let failCount = 0;

    for (const group of targetGroups) {
      try {
        await fixDuplicates("ignore_group", { groupId: group.id });
        successCount++;
      } catch {
        failCount++;
      }

      setBatchProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setIsBatchProcessing(false);
    setSelectedGroupIds(new Set());
    refresh();
    onUpdate();

    if (failCount === 0) {
      toast.success(`已忽略 ${successCount} 组`);
    } else {
      toast.warning(`已忽略 ${successCount} 组，${failCount} 组失败`);
    }
  }, [groups, selectedGroupIds, fixDuplicates, refresh, onUpdate]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // 空状态
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-4 text-lg font-medium">{TAB_TEXT.empty.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {TAB_TEXT.empty.description}
          </p>
        </CardContent>
      </Card>
    );
  }

  const allSelected = selectedGroupIds.size === groups.length;
  const hasSelection = selectedGroupIds.size > 0;

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {allSelected
              ? TAB_TEXT.actions.deselectAll
              : TAB_TEXT.actions.selectAll}
          </Button>
          <span className="text-sm text-muted-foreground">
            {TAB_TEXT.batch.selectedCount(selectedGroupIds.size, totalGroups)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchIgnore}
            disabled={!hasSelection || isBatchProcessing}
          >
            <EyeOff className="mr-1 h-4 w-4" />
            {TAB_TEXT.actions.batchIgnore}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleBatchCleanup}
            disabled={!hasSelection || isBatchProcessing}
            title={TAB_TEXT.batch.confirmTip}
          >
            {isBatchProcessing ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {TAB_TEXT.batch.processing(
                  batchProgress.done,
                  batchProgress.total,
                )}
              </>
            ) : (
              <>
                <Zap className="mr-1 h-4 w-4" />
                {TAB_TEXT.actions.batchCleanup}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 批量清理提示 */}
      {hasSelection && !isBatchProcessing && (
        <p className="text-xs text-muted-foreground">
          {TAB_TEXT.batch.confirmTip}
        </p>
      )}

      {/* 重复组列表 */}
      <div className="space-y-4">
        {groups.map((group) => (
          <DuplicateGroupCard
            key={group.id}
            group={group}
            checked={selectedGroupIds.has(group.id)}
            onCheck={handleCheck}
            onAction={handleAction}
          />
        ))}
      </div>

      {/* 分页 */}
      {totalGroups > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            第 {page} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= totalGroups}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
