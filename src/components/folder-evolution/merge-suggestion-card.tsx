"use client";

/**
 * 文件夹合并建议卡片组件
 * 展示高相似度文件夹的合并建议，支持用户确认或忽略
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Merge,
  FolderOpen,
  Check,
  X,
  Loader2,
  HelpCircle,
  ArrowRight,
  Tag,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

export interface MergeSuggestion {
  sourceFolderId: number;
  targetFolderId: number;
  sourceFolderName: string;
  targetFolderName: string;
  sourceBookmarkCount: number;
  targetBookmarkCount: number;
  similarity: number;
  sharedTags: string[];
  reason: string;
}

interface MergeSuggestionCardProps {
  suggestion: MergeSuggestion;
  onConfirm: (
    sourceFolderId: number,
    targetFolderId: number,
    newName: string,
  ) => Promise<void>;
  onDismiss: (sourceFolderId: number, targetFolderId: number) => void;
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

export function MergeSuggestionCard({
  suggestion,
  onConfirm,
  onDismiss,
  className,
}: MergeSuggestionCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [mergedName, setMergedName] = useState(suggestion.targetFolderName);

  const handleConfirm = async () => {
    if (!mergedName.trim()) {
      toast.error("请输入合并后的文件夹名称");
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm(
        suggestion.sourceFolderId,
        suggestion.targetFolderId,
        mergedName.trim(),
      );
      toast.success(
        `「${suggestion.sourceFolderName}」已合并到「${mergedName}」`,
      );
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error("合并失败，请重试");
      clientLogger.error({ error }, "[MergeSuggestionCard] Merge failed");
    } finally {
      setIsConfirming(false);
    }
  };

  // 相似度评级
  const getSimilarityBadge = (similarity: number) => {
    if (similarity >= 0.8) {
      return (
        <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <Percent className="w-3 h-3 mr-1" />
          高度相似 {Math.round(similarity * 100)}%
        </Badge>
      );
    }
    if (similarity >= 0.6) {
      return (
        <Badge
          variant="secondary"
          className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        >
          <Percent className="w-3 h-3 mr-1" />
          较为相似 {Math.round(similarity * 100)}%
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        <Percent className="w-3 h-3 mr-1" />
        {Math.round(similarity * 100)}%
      </Badge>
    );
  };

  const totalBookmarks =
    suggestion.sourceBookmarkCount + suggestion.targetBookmarkCount;

  return (
    <>
      <Card className={cn("border-blue-200 dark:border-blue-800", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Merge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  建议合并
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          这两个文件夹内容高度相似，AI 建议将它们合并为一个，
                          以减少重复并提高整理效率。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <CardDescription className="text-sm">
                  发现两个相似文件夹，建议合并整理
                </CardDescription>
              </div>
            </div>
            {getSimilarityBadge(suggestion.similarity)}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 合并预览 */}
          <div className="flex items-center gap-2">
            {/* 源文件夹 */}
            <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-dashed">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm truncate">
                  {suggestion.sourceFolderName}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {suggestion.sourceBookmarkCount} 个收藏
              </p>
            </div>

            {/* 箭头 */}
            <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />

            {/* 目标文件夹 */}
            <div className="flex-1 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-sm truncate">
                  {suggestion.targetFolderName}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {suggestion.targetBookmarkCount} 个收藏
              </p>
            </div>
          </div>

          {/* 合并后统计 */}
          <div className="text-sm text-muted-foreground text-center">
            合并后将有 <span className="font-medium">{totalBookmarks}</span>{" "}
            个收藏
          </div>

          {/* 共同标签 */}
          {suggestion.sharedTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="w-3 h-3" />
                共同标签
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestion.sharedTags.slice(0, 5).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {suggestion.sharedTags.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{suggestion.sharedTags.length - 5}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* 合并原因 */}
          <p className="text-xs text-muted-foreground">{suggestion.reason}</p>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onDismiss(suggestion.sourceFolderId, suggestion.targetFolderId)
              }
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" />
              暂不合并
            </Button>
            <Button
              size="sm"
              onClick={() => setShowConfirmDialog(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Check className="w-4 h-4 mr-1" />
              确认合并
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 确认对话框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认合并文件夹？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  将「{suggestion.sourceFolderName}」中的{" "}
                  {suggestion.sourceBookmarkCount} 个收藏合并到「
                  {suggestion.targetFolderName}」
                </p>

                <div className="space-y-2">
                  <Label htmlFor="merged-name">合并后的文件夹名称</Label>
                  <Input
                    id="merged-name"
                    value={mergedName}
                    onChange={(e) => setMergedName(e.target.value)}
                    placeholder="输入文件夹名称"
                  />
                </div>

                <p className="text-blue-600 dark:text-blue-400">
                  此操作可在 2 天内撤销。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isConfirming || !mergedName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  合并中...
                </>
              ) : (
                "确认合并"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
