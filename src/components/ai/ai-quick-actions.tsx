/**
 * AI 快捷操作组件
 *
 * 为书签提供 AI 驱动的快捷操作按钮
 * 使用专用 Quick Actions API 而非通用对话 API
 *
 * @version 1.1.0
 * @since 2025-12-22
 */

"use client";

import { useState, useCallback } from "react";
import {
  Wand2,
  Tags,
  FolderInput,
  FileText,
  Star,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  QuickActionType,
  AutoTagResult,
  AutoClassifyResult,
  ExtractKeyResult,
  RateQualityResult,
} from "@/lib/ai-actions";

// ============================================
// 类型定义
// ============================================

/** Quick Action 结果数据类型映射 */
type QuickActionResultData = {
  "auto-tag": AutoTagResult;
  "auto-classify": AutoClassifyResult;
  "extract-key": ExtractKeyResult;
  "rate-quality": RateQualityResult;
};

export interface AIQuickActionsProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle?: string;
  /** 当前标签 */
  currentTags?: string[];
  /** 当前文件夹 ID */
  currentFolderId?: number;
  /** 是否自动应用结果（默认 false） */
  autoApply?: boolean;
  /** 操作完成回调 */
  onActionComplete?: <T extends QuickActionType>(
    action: T,
    result: QuickActionResultData[T],
    applied: boolean,
  ) => void;
  /** 自定义类名 */
  className?: string;
}

interface QuickAction {
  id: QuickActionType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

type ActionStatus = "idle" | "loading" | "success" | "error";

interface ActionState {
  status: ActionStatus;
  message?: string;
}

// ============================================
// 常量配置
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "auto-tag",
    label: "智能标签",
    description: "AI 自动推荐标签",
    icon: Tags,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "auto-classify",
    label: "智能分类",
    description: "AI 推荐文件夹",
    icon: FolderInput,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    id: "extract-key",
    label: "提取要点",
    description: "提取关键信息",
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    id: "rate-quality",
    label: "质量评估",
    description: "AI 评估内容质量",
    icon: Star,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
];

// ============================================
// 组件
// ============================================

export function AIQuickActions({
  bookmarkId,
  bookmarkTitle: _bookmarkTitle,
  currentTags: _currentTags,
  currentFolderId: _currentFolderId,
  autoApply = false,
  onActionComplete,
  className,
}: AIQuickActionsProps) {
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {},
  );

  /**
   * 格式化操作结果为用户友好的消息
   */
  const formatResultMessage = (
    actionId: QuickActionType,
    data: QuickActionResultData[typeof actionId],
    applied: boolean,
  ): string => {
    switch (actionId) {
      case "auto-tag": {
        const tagData = data as AutoTagResult;
        const tagCount = tagData.newTags.length;
        if (tagCount === 0) return "未发现新标签";
        return applied
          ? `已添加 ${tagCount} 个标签`
          : `推荐 ${tagCount} 个新标签`;
      }
      case "auto-classify": {
        const classifyData = data as AutoClassifyResult;
        if (!classifyData.folderId) return "建议创建新文件夹";
        return applied
          ? `已移动到「${classifyData.folderName}」`
          : `推荐「${classifyData.folderName}」`;
      }
      case "extract-key": {
        const keyData = data as ExtractKeyResult;
        return `提取 ${keyData.keyPoints.length} 个要点`;
      }
      case "rate-quality": {
        const rateData = data as RateQualityResult;
        return applied
          ? `评分 ${rateData.rating} 星`
          : `建议评分 ${rateData.rating} 星`;
      }
      default:
        return "完成";
    }
  };

  /**
   * 执行快捷操作
   */
  const executeAction = useCallback(
    async (action: QuickAction) => {
      const actionId = action.id;

      // 设置加载状态
      setActionStates((prev) => ({
        ...prev,
        [actionId]: { status: "loading" },
      }));

      try {
        // 调用新的 Quick Actions API
        const res = await fetch("/api/ai/quick-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: actionId,
            bookmarkId,
            autoApply,
          }),
        });

        const result = await res.json();

        if (!result.success) {
          throw new Error(result.error || "操作失败");
        }

        // 格式化成功消息
        const message = formatResultMessage(
          actionId,
          result.data,
          result.applied,
        );

        // 设置成功状态
        setActionStates((prev) => ({
          ...prev,
          [actionId]: {
            status: "success",
            message,
          },
        }));

        // 回调
        onActionComplete?.(actionId, result.data, result.applied);

        // 3 秒后重置状态
        setTimeout(() => {
          setActionStates((prev) => ({
            ...prev,
            [actionId]: { status: "idle" },
          }));
        }, 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失败";

        setActionStates((prev) => ({
          ...prev,
          [actionId]: { status: "error", message },
        }));

        // 5 秒后重置状态
        setTimeout(() => {
          setActionStates((prev) => ({
            ...prev,
            [actionId]: { status: "idle" },
          }));
        }, 5000);
      }
    },
    [bookmarkId, autoApply, onActionComplete],
  );

  /**
   * 获取按钮图标
   */
  const getButtonIcon = (action: QuickAction) => {
    const state = actionStates[action.id];

    if (state?.status === "loading") {
      return <Loader2 className="size-4 animate-spin" />;
    }
    if (state?.status === "success") {
      return <CheckCircle className="size-4 text-green-500" />;
    }
    if (state?.status === "error") {
      return <AlertCircle className="size-4 text-red-500" />;
    }
    return <action.icon className={cn("size-4", action.color)} />;
  };

  /**
   * 检查是否有操作正在执行
   */
  const isAnyLoading = Object.values(actionStates).some(
    (state) => state.status === "loading",
  );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
            <Wand2 className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">AI 快捷操作</CardTitle>
            <CardDescription className="text-xs">
              一键执行智能处理
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => {
            const state = actionStates[action.id];
            const isSuccess = state?.status === "success";
            const isError = state?.status === "error";

            return (
              <TooltipProvider key={action.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-auto py-3 px-3 flex flex-col items-center gap-1.5 transition-all",
                        isSuccess &&
                          "border-green-500 bg-green-50 dark:bg-green-900/20",
                        isError &&
                          "border-red-500 bg-red-50 dark:bg-red-900/20",
                      )}
                      onClick={() => executeAction(action)}
                      disabled={isAnyLoading}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center size-8 rounded-full transition-colors",
                          isSuccess
                            ? "bg-green-100 dark:bg-green-900/30"
                            : isError
                              ? "bg-red-100 dark:bg-red-900/30"
                              : action.bgColor,
                        )}
                      >
                        {getButtonIcon(action)}
                      </div>
                      <span className="text-xs font-medium">
                        {action.label}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{action.description}</p>
                    {state?.message && state.status === "success" && (
                      <p className="text-green-500 text-xs mt-1">
                        ✓ {state.message}
                      </p>
                    )}
                    {state?.message && state.status === "error" && (
                      <p className="text-red-400 text-xs mt-1">
                        {state.message}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* 提示 */}
        <p className="text-xs text-muted-foreground text-center mt-3">
          点击按钮让 AI 自动处理
        </p>
      </CardContent>
    </Card>
  );
}

export default AIQuickActions;
