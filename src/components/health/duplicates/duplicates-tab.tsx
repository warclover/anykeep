/**
 * 重复内容 Tab 组件
 */

"use client";

import { useState } from "react";
import {
  Copy,
  Trash2,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  },
  matchTypes: {
    exact_url: "完全相同",
    normalized_url: "URL 相似",
    semantic: "语义相似",
  },
};

// ============================================
// 重复组组件
// ============================================

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  onAction: (action: string, params: Record<string, unknown>) => Promise<void>;
}

function DuplicateGroupCard({ group, onAction }: DuplicateGroupCardProps) {
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
  const { groups, totalGroups, isLoading, error, refresh } =
    useDuplicates(page);
  const { fixDuplicates } = useHealthFix();

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        共发现 {totalGroups} 组重复内容
      </p>

      {/* 重复组列表 */}
      <div className="space-y-4">
        {groups.map((group) => (
          <DuplicateGroupCard
            key={group.id}
            group={group}
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
