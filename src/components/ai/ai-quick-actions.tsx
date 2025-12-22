/**
 * AI 快捷操作组件
 *
 * 为书签提供 AI 驱动的快捷操作按钮
 *
 * @version 1.0.0
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

// ============================================
// 类型定义
// ============================================

export interface AIQuickActionsProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle?: string;
  /** 当前标签 */
  currentTags?: string[];
  /** 当前文件夹 ID */
  currentFolderId?: number;
  /** 操作完成回调 */
  onActionComplete?: (action: string, result: unknown) => void;
  /** 自定义类名 */
  className?: string;
}

interface QuickAction {
  id: string;
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
  onActionComplete,
  className,
}: AIQuickActionsProps) {
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {},
  );

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
        // 构建提示语
        const prompts: Record<string, string> = {
          "auto-tag": "请为这篇内容推荐 3-5 个合适的标签，以逗号分隔",
          "auto-classify": "请推荐一个最合适的文件夹分类，并说明原因",
          "extract-key": "请提取这篇内容的 3-5 个关键要点",
          "rate-quality": "请评估这篇内容的质量（1-5分），并简要说明评分理由",
        };

        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompts[actionId] || "请分析这篇内容",
            bookmarkIds: [bookmarkId],
            options: { streaming: false },
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "操作失败");
        }

        const result = await res.json();

        // 设置成功状态
        setActionStates((prev) => ({
          ...prev,
          [actionId]: {
            status: "success",
            message: "完成",
          },
        }));

        // 回调
        onActionComplete?.(actionId, result.data);

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
    [bookmarkId, onActionComplete],
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
