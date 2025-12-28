/**
 * ReAct 思考过程展示组件
 *
 * 显示 AI 的 Think → Act → Observe 循环过程
 * 支持折叠/展开，仅对 Pro 用户可见
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { memo, useState, useMemo } from "react";
import {
  Brain,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  ThinkingPhase,
  ThinkingRecord,
} from "@/hooks/domain/ai/use-ai-chat";

// ============================================
// 类型定义
// ============================================

export interface ReactThinkingDisplayProps {
  /** 思考记录列表 */
  thinking: ThinkingRecord[];
  /** 是否正在思考中 */
  isThinking?: boolean;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 常量配置
// ============================================

/** 阶段配置 */
const PHASE_CONFIG: Record<
  ThinkingPhase,
  { label: string; icon: typeof Brain; color: string }
> = {
  understanding: {
    label: "理解意图",
    icon: Brain,
    color: "text-blue-500",
  },
  planning: {
    label: "制定计划",
    icon: Brain,
    color: "text-purple-500",
  },
  deciding: {
    label: "决策判断",
    icon: Brain,
    color: "text-indigo-500",
  },
  executing: {
    label: "执行操作",
    icon: Zap,
    color: "text-orange-500",
  },
  react_think: {
    label: "思考",
    icon: Brain,
    color: "text-blue-500",
  },
  react_act: {
    label: "行动",
    icon: Zap,
    color: "text-orange-500",
  },
  react_observe: {
    label: "观察",
    icon: Eye,
    color: "text-green-500",
  },
  react_complete: {
    label: "完成",
    icon: CheckCircle2,
    color: "text-green-600",
  },
};

// ============================================
// 辅助组件
// ============================================

/**
 * 单个思考步骤
 */
const ThinkingStep = memo(function ThinkingStep({
  record,
  isLast,
}: {
  record: ThinkingRecord;
  isLast: boolean;
}) {
  const config = PHASE_CONFIG[record.phase];
  const Icon = config.icon;

  // 判断是否是 ReAct 模式
  const isReactMode = record.phase.startsWith("react_");

  return (
    <div className="relative flex gap-3">
      {/* 连接线 */}
      {!isLast && (
        <div className="absolute left-3.5 top-7 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
      )}

      {/* 图标 */}
      <div
        className={cn(
          "flex-shrink-0 size-7 rounded-full flex items-center justify-center",
          record.isFinal
            ? "bg-green-100 dark:bg-green-900/30"
            : "bg-gray-100 dark:bg-gray-800",
        )}
      >
        <Icon className={cn("size-4", config.color)} />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", config.color)}>
            {config.label}
          </span>
          {isReactMode && record.round && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Round {record.round}
            </span>
          )}
          {record.isFinal && (
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
              Final
            </span>
          )}
        </div>
        {record.content && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {record.content}
          </p>
        )}
      </div>
    </div>
  );
});

/**
 * 思考中动画
 */
const ThinkingAnimation = memo(function ThinkingAnimation() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <Loader2 className="size-4 animate-spin text-purple-500" />
      <span>AI 正在思考...</span>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * ReAct 思考过程展示组件
 *
 * @example
 * ```tsx
 * <ReactThinkingDisplay
 *   thinking={message.thinking || []}
 *   isThinking={message.isStreaming}
 *   defaultExpanded={false}
 * />
 * ```
 */
export const ReactThinkingDisplay = memo(function ReactThinkingDisplay({
  thinking,
  isThinking = false,
  defaultExpanded = false,
  className,
}: ReactThinkingDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 按轮次分组（仅 ReAct 模式）
  const groupedByRound = useMemo(() => {
    const rounds = new Map<number, ThinkingRecord[]>();
    let currentRound = 1;

    for (const record of thinking) {
      const round = record.round || currentRound;
      if (!rounds.has(round)) {
        rounds.set(round, []);
      }
      rounds.get(round)!.push(record);
      currentRound = round;
    }

    return rounds;
  }, [thinking]);

  // 判断是否是 ReAct 模式
  const isReactMode = thinking.some((r) => r.phase.startsWith("react_"));

  // 当前轮次
  const currentRound = Math.max(...Array.from(groupedByRound.keys()), 1);

  // 如果没有思考记录且不在思考中，不显示
  if (thinking.length === 0 && !isThinking) {
    return null;
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          "rounded-lg border bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-100 dark:border-blue-900/30",
          className,
        )}
      >
        {/* 头部 */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isReactMode ? "ReAct 思考过程" : "AI 思考过程"}
              </span>
              {isReactMode && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Round {currentRound}
                </span>
              )}
              {isThinking && (
                <Loader2 className="size-3.5 animate-spin text-purple-500" />
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="size-4 text-gray-400" />
            ) : (
              <ChevronDown className="size-4 text-gray-400" />
            )}
          </button>
        </CollapsibleTrigger>

        {/* 内容 */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1">
            {/* 思考步骤列表 */}
            <div className="space-y-0">
              {thinking.map((record, index) => (
                <ThinkingStep
                  key={`${record.phase}-${record.timestamp}-${index}`}
                  record={record}
                  isLast={index === thinking.length - 1 && !isThinking}
                />
              ))}
            </div>

            {/* 思考中动画 */}
            {isThinking && <ThinkingAnimation />}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

/**
 * 内联版思考指示器（简化版）
 */
export const ReactThinkingIndicator = memo(function ReactThinkingIndicator({
  phase,
  round,
}: {
  phase: ThinkingPhase;
  round?: number;
}) {
  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={cn("size-4", config.color)} />
      <span className={cn("font-medium", config.color)}>{config.label}</span>
      {round && <span className="text-xs text-gray-400">Round {round}</span>}
    </div>
  );
});

export default ReactThinkingDisplay;
