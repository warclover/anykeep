"use client";

/**
 * 文件夹分拆建议卡片组件
 * 展示低内聚文件夹的分拆建议，支持用户确认或忽略
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
import {
  Scissors,
  FolderOpen,
  AlertTriangle,
  Check,
  X,
  Loader2,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// 类型定义
// ============================================================================

export interface SplitOption {
  name: string;
  bookmarkIds: number[];
  sampleTitles: string[];
}

export interface SplitSuggestion {
  folderId: number;
  folderName: string;
  bookmarkCount: number;
  internalSimilarity: number;
  suggestedSplits: SplitOption[];
  reason: string;
}

interface SplitSuggestionCardProps {
  suggestion: SplitSuggestion;
  onConfirm: (folderId: number, splits: SplitOption[]) => Promise<void>;
  onDismiss: (folderId: number) => void;
  className?: string;
}

// ============================================================================
// 组件实现
// ============================================================================

export function SplitSuggestionCard({
  suggestion,
  onConfirm,
  onDismiss,
  className,
}: SplitSuggestionCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedSplits, _setSelectedSplits] = useState<SplitOption[]>(
    suggestion.suggestedSplits,
  );

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(suggestion.folderId, selectedSplits);
      toast.success(
        `「${suggestion.folderName}」已分拆为 ${selectedSplits.length} 个文件夹`,
      );
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error("分拆失败，请重试");
      console.error("Split failed:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  // 内聚度评级
  const getSimilarityBadge = (similarity: number) => {
    if (similarity < 0.3) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          低内聚
        </Badge>
      );
    }
    if (similarity < 0.5) {
      return (
        <Badge
          variant="secondary"
          className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        >
          中等内聚
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        内聚度良好
      </Badge>
    );
  };

  return (
    <>
      <Card className={cn("border-amber-200 dark:border-amber-800", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Scissors className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  建议分拆
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          该文件夹内容较为分散，AI
                          建议将其分拆为多个更专注的文件夹， 以提高查找效率。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <CardDescription className="text-sm">
                  「{suggestion.folderName}」内容分散，建议拆分
                </CardDescription>
              </div>
            </div>
            {getSimilarityBadge(suggestion.internalSimilarity)}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 当前文件夹信息 */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{suggestion.folderName}</p>
              <p className="text-xs text-muted-foreground">
                {suggestion.bookmarkCount} 个收藏 · 内聚度{" "}
                {Math.round(suggestion.internalSimilarity * 100)}%
              </p>
            </div>
          </div>

          {/* 分拆建议预览 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              建议分拆为：
            </p>
            {suggestion.suggestedSplits.map((split, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-lg border bg-background"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{split.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {split.bookmarkIds.length} 个收藏 · 如「
                    {split.sampleTitles[0]}」等
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 分拆原因 */}
          <p className="text-xs text-muted-foreground">{suggestion.reason}</p>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDismiss(suggestion.folderId)}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" />
              暂不分拆
            </Button>
            <Button
              size="sm"
              onClick={() => setShowConfirmDialog(true)}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              <Check className="w-4 h-4 mr-1" />
              确认分拆
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 确认对话框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认分拆文件夹？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                将「{suggestion.folderName}」分拆为 {selectedSplits.length}{" "}
                个新文件夹：
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                {selectedSplits.map((split, i) => (
                  <li key={i} className="text-sm">
                    {split.name}（{split.bookmarkIds.length} 个收藏）
                  </li>
                ))}
              </ul>
              <p className="text-amber-600 dark:text-amber-400 mt-3">
                此操作可在 2 天内撤销。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isConfirming}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  分拆中...
                </>
              ) : (
                "确认分拆"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
