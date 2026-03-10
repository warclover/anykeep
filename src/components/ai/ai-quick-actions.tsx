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
  X,
  Clock,
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
import { API_AI } from "@/lib/constants/api-paths";
import { MESSAGES } from "@/lib/constants/messages";
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

/** 提取要点结果面板数据 */
interface KeyPointsPanel {
  tldr: string;
  keyPoints: string[];
  keywords: string[];
  sentiment?: "positive" | "neutral" | "negative";
  readingTime?: number;
}

// ============================================
// 常量配置
// ============================================

const { QUICK_ACTIONS: QA_TEXT } = MESSAGES.AI_COMPONENTS;

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "auto-tag",
    label: QA_TEXT.ACTIONS.AUTO_TAG.LABEL,
    description: QA_TEXT.ACTIONS.AUTO_TAG.DESCRIPTION,
    icon: Tags,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    id: "auto-classify",
    label: QA_TEXT.ACTIONS.AUTO_CLASSIFY.LABEL,
    description: QA_TEXT.ACTIONS.AUTO_CLASSIFY.DESCRIPTION,
    icon: FolderInput,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    id: "extract-key",
    label: QA_TEXT.ACTIONS.EXTRACT_KEY.LABEL,
    description: QA_TEXT.ACTIONS.EXTRACT_KEY.DESCRIPTION,
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    id: "rate-quality",
    label: QA_TEXT.ACTIONS.RATE_QUALITY.LABEL,
    description: QA_TEXT.ACTIONS.RATE_QUALITY.DESCRIPTION,
    icon: Star,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
];

// ============================================
// 组件
// ============================================

const SENTIMENT_LABELS = QA_TEXT.SENTIMENT;

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
  const [keyPointsPanel, setKeyPointsPanel] = useState<KeyPointsPanel | null>(
    null,
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
        if (tagCount === 0) return QA_TEXT.RESULTS.NO_NEW_TAGS;
        return applied
          ? QA_TEXT.RESULTS.TAGS_ADDED(tagCount)
          : QA_TEXT.RESULTS.TAGS_RECOMMENDED(tagCount);
      }
      case "auto-classify": {
        const classifyData = data as AutoClassifyResult;
        if (!classifyData.folderId) return QA_TEXT.RESULTS.SUGGEST_NEW_FOLDER;
        return applied
          ? QA_TEXT.RESULTS.MOVED_TO_FOLDER(classifyData.folderName)
          : QA_TEXT.RESULTS.RECOMMEND_FOLDER(classifyData.folderName);
      }
      case "extract-key": {
        const keyData = data as ExtractKeyResult;
        return QA_TEXT.RESULTS.KEY_POINTS_EXTRACTED(keyData.keyPoints.length);
      }
      case "rate-quality": {
        const rateData = data as RateQualityResult;
        return applied
          ? QA_TEXT.RESULTS.RATING_APPLIED(rateData.rating)
          : QA_TEXT.RESULTS.RATING_SUGGESTED(rateData.rating);
      }
      default:
        return QA_TEXT.RESULTS.DONE;
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
        const res = await fetch(API_AI.quickActions, {
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

        // 提取要点：展示结果面板，不自动重置
        if (actionId === "extract-key") {
          const keyData = result.data as ExtractKeyResult;
          setKeyPointsPanel({
            tldr: keyData.tldr,
            keyPoints: keyData.keyPoints,
            keywords: keyData.keywords,
            sentiment: keyData.sentiment,
            readingTime: keyData.readingTime,
          });
        } else {
          // 其他操作 3 秒后重置
          setTimeout(() => {
            setActionStates((prev) => ({
              ...prev,
              [actionId]: { status: "idle" },
            }));
          }, 3000);
        }

        // 回调
        onActionComplete?.(actionId, result.data, result.applied);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : QA_TEXT.ACTION_FAILED;

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
            <CardTitle className="text-base">{QA_TEXT.CARD_TITLE}</CardTitle>
            <CardDescription className="text-xs">
              {QA_TEXT.CARD_DESCRIPTION}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex gap-2">
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
                        "h-auto py-2 px-2.5 flex-1 flex items-center gap-1.5 transition-all",
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
                          "flex items-center justify-center size-6 shrink-0 rounded-full transition-colors",
                          isSuccess
                            ? "bg-green-100 dark:bg-green-900/30"
                            : isError
                              ? "bg-red-100 dark:bg-red-900/30"
                              : action.bgColor,
                        )}
                      >
                        {getButtonIcon(action)}
                      </div>
                      <span className="text-xs font-medium whitespace-nowrap">
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
          {QA_TEXT.CARD_HINT}
        </p>

        {/* 提取要点结果面板 */}
        {keyPointsPanel && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10 p-3 space-y-3">
            {/* 面板头部 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {QA_TEXT.PANEL_TITLE}
                </span>
                {keyPointsPanel.readingTime && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {QA_TEXT.MINUTES(keyPointsPanel.readingTime)}
                  </span>
                )}
                {keyPointsPanel.sentiment && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {SENTIMENT_LABELS[keyPointsPanel.sentiment]}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setKeyPointsPanel(null);
                  setActionStates((prev) => ({
                    ...prev,
                    "extract-key": { status: "idle" },
                  }));
                }}
              >
                <X className="size-3" />
              </Button>
            </div>

            {/* 一句话总结 */}
            {keyPointsPanel.tldr && (
              <p className="text-xs text-foreground/80 italic border-l-2 border-amber-400 pl-2">
                {keyPointsPanel.tldr}
              </p>
            )}

            {/* 关键要点列表 */}
            {keyPointsPanel.keyPoints.length > 0 && (
              <ul className="space-y-1.5">
                {keyPointsPanel.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-400 font-medium">
                      {i + 1}
                    </span>
                    <span className="text-foreground/80 leading-relaxed">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* 关键词 */}
            {keyPointsPanel.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-amber-200 dark:border-amber-800/50">
                {keyPointsPanel.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIQuickActions;
