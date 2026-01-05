/**
 * Brain-Sync Integration Button - 从报告生成复习卡片的按钮
 * @module components/knowledge-studio/brain-sync-button
 */

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useBrainSyncIntegration } from "@/hooks/domain/knowledge-studio/use-brain-sync-integration";
import type { SynthesisReport } from "@/lib/knowledge-studio/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Question depth 显示配置
 */
const DEPTH_CONFIG: Record<string, { label: string; color: string }> = {
  understand: {
    label: "理解",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  apply: {
    label: "应用",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  analyze: {
    label: "分析",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  evaluate: {
    label: "评价",
    color:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

interface BrainSyncButtonProps {
  report: SynthesisReport;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function BrainSyncButton({
  report,
  variant = "outline",
  size = "sm",
  className,
}: BrainSyncButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );

  const {
    status,
    flashcardPreviews,
    result,
    error,
    generateFromReport,
    confirmCreate,
    reset,
  } = useBrainSyncIntegration({
    onComplete: (result) => {
      if (result.success) {
        toast.success(`已创建 ${result.count} 个复习卡片`);
        setDialogOpen(false);
      }
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // 打开对话框并生成预览
  const handleOpenDialog = useCallback(async () => {
    setDialogOpen(true);
    setSelectedIndices(new Set());
    await generateFromReport(report);
  }, [generateFromReport, report]);

  // 关闭对话框
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    reset();
  }, [reset]);

  // 切换选择
  const toggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIndices.size === flashcardPreviews.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(flashcardPreviews.map((_, i) => i)));
    }
  }, [selectedIndices.size, flashcardPreviews]);

  // 确认创建
  const handleConfirm = useCallback(async () => {
    const indices =
      selectedIndices.size > 0
        ? Array.from(selectedIndices)
        : flashcardPreviews.map((_, i) => i);

    if (indices.length === 0) {
      toast.error("请至少选择一个复习卡片");
      return;
    }

    await confirmCreate(indices);
  }, [selectedIndices, flashcardPreviews, confirmCreate]);

  const isGenerating = status === "generating";
  const isCreating = status === "creating";
  const isCompleted = status === "completed";
  const isError = status === "error";
  const hasPreview = flashcardPreviews.length > 0;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpenDialog}
        disabled={!report.content || report.content.length < 50}
      >
        <Brain className="mr-1 h-4 w-4" />
        Brain-Sync
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              生成复习卡片
            </DialogTitle>
            <DialogDescription>
              从报告内容生成深度复习卡片，帮助你内化知识
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-[300px]">
            {/* Loading state */}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  正在分析报告内容，生成复习卡片...
                </p>
              </div>
            )}

            {/* Error state */}
            {isError && error && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-destructive">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => generateFromReport(report)}
                >
                  重试
                </Button>
              </div>
            )}

            {/* Completed state */}
            {isCompleted && result?.success && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-muted-foreground">
                  已成功创建 {result.count} 个复习卡片
                </p>
              </div>
            )}

            {/* Preview state */}
            {hasPreview && !isGenerating && !isCompleted && (
              <div className="space-y-4 p-1">
                {/* Select all */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={
                        selectedIndices.size === flashcardPreviews.length &&
                        flashcardPreviews.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      全选 ({flashcardPreviews.length} 个卡片)
                    </label>
                  </div>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    已选{" "}
                    {selectedIndices.size > 0
                      ? selectedIndices.size
                      : flashcardPreviews.length}
                  </Badge>
                </div>

                {/* Flashcard list */}
                <div className="space-y-3">
                  {flashcardPreviews.map((card, index) => {
                    const depthConfig =
                      DEPTH_CONFIG[card.questionDepth] ||
                      DEPTH_CONFIG.understand;
                    const isSelected =
                      selectedIndices.size === 0 || selectedIndices.has(index);

                    return (
                      <div
                        key={index}
                        className={cn(
                          "border rounded-lg p-4 cursor-pointer transition-all",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground",
                        )}
                        onClick={() => toggleSelect(index)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(index)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={depthConfig.color}
                                variant="secondary"
                              >
                                {depthConfig.label}
                              </Badge>
                            </div>
                            <p className="font-medium">{card.question}</p>
                            <p className="text-sm text-muted-foreground italic">
                              💡 {card.thinkingHint}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {card.keyPoints.map((point, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {point}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isCreating}
            >
              取消
            </Button>
            {hasPreview && !isCompleted && (
              <Button
                onClick={handleConfirm}
                disabled={isGenerating || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    创建{" "}
                    {selectedIndices.size > 0
                      ? selectedIndices.size
                      : flashcardPreviews.length}{" "}
                    个卡片
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
