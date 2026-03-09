/**
 * AI 记忆查看器组件
 *
 * 展示 AI 跨会话记忆内容，包括：
 * - 最近会话摘要
 * - 待办事项
 * - 学习到的偏好
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

"use client";

import { memo, useState, useCallback, useEffect } from "react";
import {
  Brain,
  Clock,
  Lightbulb,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MESSAGES } from "@/lib/constants/messages";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ============================================
// 类型定义
// ============================================

interface RecentSummary {
  summary: string;
  intents: string[];
  timeAgo: string;
  learnedPreferences?: Record<string, string>;
}

interface AIMemory {
  recentSummaries: RecentSummary[];
  learnedPreferences: Record<string, string>;
}

interface AIMemoryViewerProps {
  /** 自定义类名 */
  className?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 数据加载函数 */
  onLoad?: () => Promise<AIMemory>;
  /** 清除记忆回调 */
  onClear?: () => Promise<void>;
}

// ============================================
// UI 文本常量
// ============================================

const { MEMORY_VIEWER } = MESSAGES.AI_COMPONENTS;

const UI_TEXT = {
  title: MEMORY_VIEWER.TITLE,
  description: MEMORY_VIEWER.DESCRIPTION,
  sections: {
    summaries: {
      title: MEMORY_VIEWER.SECTIONS.SUMMARIES.TITLE,
      empty: MEMORY_VIEWER.SECTIONS.SUMMARIES.EMPTY,
    },
    preferences: {
      title: MEMORY_VIEWER.SECTIONS.PREFERENCES.TITLE,
      empty: MEMORY_VIEWER.SECTIONS.PREFERENCES.EMPTY,
    },
  },
  actions: {
    refresh: MEMORY_VIEWER.ACTIONS.REFRESH,
    clear: MEMORY_VIEWER.ACTIONS.CLEAR,
    clearConfirm: {
      title: MEMORY_VIEWER.ACTIONS.CLEAR_CONFIRM.TITLE,
      description: MEMORY_VIEWER.ACTIONS.CLEAR_CONFIRM.DESCRIPTION,
      cancel: MESSAGES.COMMON.CANCEL,
      confirm: MEMORY_VIEWER.ACTIONS.CLEAR_CONFIRM.CONFIRM,
    },
  },
  states: {
    loading: MEMORY_VIEWER.STATES.LOADING,
    error: MEMORY_VIEWER.STATES.ERROR,
    empty: MEMORY_VIEWER.STATES.EMPTY,
  },
} as const;

// ============================================
// 子组件
// ============================================

/**
 * 摘要列表项
 */
const SummaryItem = memo(function SummaryItem({
  summary,
}: {
  summary: RecentSummary;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
      <div className="flex items-start gap-2">
        <Clock className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 leading-relaxed">
            {summary.summary}
          </p>
          {summary.intents.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {summary.intents.map((intent, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {intent}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 pl-6">{summary.timeAgo}</p>
    </div>
  );
});

/**
 * 偏好列表项
 */
const PreferenceItem = memo(function PreferenceItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg">
      <Lightbulb className="size-4 text-violet-500 flex-shrink-0" />
      <span className="text-sm">
        <span className="text-gray-500">{label}：</span>
        <span className="text-gray-700 font-medium">{value}</span>
      </span>
    </div>
  );
});

/**
 * 可折叠区块
 */
const Section = memo(function Section({
  title,
  count,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full py-2 hover:bg-gray-50 rounded-md px-2 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{title}</span>
            {count > 0 && (
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="size-4 text-gray-400" />
          ) : (
            <ChevronDown className="size-4 text-gray-400" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * AI 记忆查看器
 *
 * 展示和管理 AI 跨会话记忆
 */
export const AIMemoryViewer = memo(function AIMemoryViewer({
  className,
  defaultExpanded = true,
  onLoad,
  onClear,
}: AIMemoryViewerProps) {
  const [memory, setMemory] = useState<AIMemory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // 加载记忆数据
  const loadMemory = useCallback(async () => {
    if (!onLoad) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await onLoad();
      setMemory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : MEMORY_VIEWER.STATES.ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [onLoad]);

  // 初始加载
  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  // 清除记忆
  const handleClear = useCallback(async () => {
    if (!onClear) return;

    setIsClearing(true);
    try {
      await onClear();
      setMemory({
        recentSummaries: [],
        learnedPreferences: {},
      });
    } finally {
      setIsClearing(false);
    }
  }, [onClear]);

  // 计算是否为空
  const isEmpty =
    memory &&
    memory.recentSummaries.length === 0 &&
    Object.keys(memory.learnedPreferences).length === 0;

  // 聚合学习偏好（从摘要中提取）
  const aggregatedPreferences = memory
    ? {
        ...memory.learnedPreferences,
        ...memory.recentSummaries.reduce(
          (acc, s) => ({ ...acc, ...s.learnedPreferences }),
          {} as Record<string, string>,
        ),
      }
    : {};

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-violet-600" />
            <div>
              <CardTitle className="text-base">{UI_TEXT.title}</CardTitle>
              <CardDescription className="text-xs">
                {UI_TEXT.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMemory}
              disabled={isLoading}
              className="h-8"
            >
              <RefreshCw
                className={cn("size-4", isLoading && "animate-spin")}
              />
            </Button>
            {onClear && memory && !isEmpty && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    disabled={isClearing}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {UI_TEXT.actions.clearConfirm.title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {UI_TEXT.actions.clearConfirm.description}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {UI_TEXT.actions.clearConfirm.cancel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClear}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      {UI_TEXT.actions.clearConfirm.confirm}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 加载状态 */}
        {isLoading && !memory && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-600">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && !error && isEmpty && (
          <div className="py-8 text-center text-gray-400">
            <Brain className="size-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{UI_TEXT.states.empty}</p>
          </div>
        )}

        {/* 内容区域 */}
        {!isLoading && !error && memory && !isEmpty && (
          <div className="space-y-3">
            {/* 学习偏好 */}
            <Section
              title={UI_TEXT.sections.preferences.title}
              count={Object.keys(aggregatedPreferences).length}
              icon={Lightbulb}
              defaultOpen={Object.keys(aggregatedPreferences).length > 0}
            >
              {Object.keys(aggregatedPreferences).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(aggregatedPreferences).map(([key, value]) => (
                    <PreferenceItem key={key} label={key} value={value} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">
                  {UI_TEXT.sections.preferences.empty}
                </p>
              )}
            </Section>

            {/* 最近对话 */}
            <Section
              title={UI_TEXT.sections.summaries.title}
              count={memory.recentSummaries.length}
              icon={Clock}
              defaultOpen={defaultExpanded}
            >
              {memory.recentSummaries.length > 0 ? (
                <div className="space-y-2">
                  {memory.recentSummaries.map((summary, idx) => (
                    <SummaryItem key={idx} summary={summary} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">
                  {UI_TEXT.sections.summaries.empty}
                </p>
              )}
            </Section>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default AIMemoryViewer;
