/**
 * 任务结果卡片组件
 *
 * 零接管模式的核心 UI 组件，用于展示：
 * - 执行结果摘要
 * - AI 思考过程（可展开）
 * - 智能默认值决策
 * - 一键撤销能力
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Brain,
  ChevronDown,
  Undo2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  TaskExecutionResult,
  SmartDefault,
} from "@/lib/ai-agent/task-understanding/types";

// ============================================
// 类型定义
// ============================================

/**
 * TaskResultCard 属性
 */
export interface TaskResultCardProps {
  /** 执行结果 */
  result: TaskExecutionResult;

  /** 撤销回调 */
  onUndo?: (undoId: string) => Promise<void>;

  /** 调整反馈回调 */
  onAdjust?: (feedback: string) => void;

  /** 自定义类名 */
  className?: string;

  /** 是否正在撤销 */
  isUndoing?: boolean;

  /** 是否已撤销 */
  undone?: boolean;
}

// ============================================
// 常量配置
// ============================================

const SMART_DEFAULT_SOURCE_LABELS: Record<string, string> = {
  user_preference: "基于你的习惯",
  context_infer: "根据上下文推断",
  system_default: "系统默认",
};

const SMART_DEFAULT_SOURCE_COLORS: Record<string, string> = {
  user_preference: "bg-green-100 text-green-700 border-green-200",
  context_infer: "bg-blue-100 text-blue-700 border-blue-200",
  system_default: "bg-gray-100 text-gray-600 border-gray-200",
};

// ============================================
// 主组件
// ============================================

/**
 * 任务结果卡片
 *
 * 展示零接管模式的执行结果
 */
export function TaskResultCard({
  result,
  onUndo,
  onAdjust,
  className,
  isUndoing = false,
  undone = false,
}: TaskResultCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  const {
    success,
    summary,
    understanding,
    canUndo,
    undoInfo,
    executionTimeMs,
  } = result;

  const handleUndo = useCallback(async () => {
    if (undoInfo && onUndo) {
      await onUndo(undoInfo.undoId);
    }
  }, [undoInfo, onUndo]);

  const handleAdjustClick = useCallback(() => {
    if (onAdjust) {
      onAdjust("下次按不同方式处理");
    }
  }, [onAdjust]);

  // 已撤销状态
  if (undone) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-gray-50 border-gray-200 p-4",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Undo2 className="h-4 w-4" />
          <span>操作已撤销</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all",
        success
          ? "bg-green-50/50 border-green-200"
          : "bg-red-50/50 border-red-200",
        className,
      )}
    >
      {/* 结果头部 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {success ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-relaxed">{summary}</p>
            {executionTimeMs && (
              <p className="text-xs text-muted-foreground mt-1">
                执行耗时 {(executionTimeMs / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>

        {/* 撤销按钮 */}
        {canUndo && undoInfo && !isUndoing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            className="text-muted-foreground hover:text-destructive flex-shrink-0"
          >
            <Undo2 className="h-4 w-4 mr-1" />
            撤销
            <span className="ml-1 text-xs opacity-60">(5分钟内)</span>
          </Button>
        )}

        {isUndoing && (
          <span className="text-xs text-muted-foreground">撤销中...</span>
        )}
      </div>

      {/* AI 思考过程（可展开） */}
      {understanding && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Brain className="h-3 w-3" />
            {showReasoning ? "收起思考过程" : "查看 AI 思考过程"}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                showReasoning && "rotate-180",
              )}
            />
          </button>

          {showReasoning && (
            <div className="mt-2 text-sm bg-muted/50 rounded-lg p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* 目标理解 */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  我理解你想要：
                </p>
                <p className="text-sm">{understanding.goal}</p>
              </div>

              {/* 决策依据 */}
              {understanding.reasoning && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    决策依据：
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {understanding.reasoning}
                  </p>
                </div>
              )}

              {/* 智能默认值 */}
              {understanding.appliedDefaults &&
                understanding.appliedDefaults.length > 0 && (
                  <SmartDefaultsList defaults={understanding.appliedDefaults} />
                )}

              {/* 置信度 */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>
                  置信度：{Math.round(understanding.confidence * 100)}%
                </span>
              </div>

              {/* 快速反馈 */}
              {onAdjust && (
                <div className="pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={handleAdjustClick}
                  >
                    下次换种方式
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 子组件
// ============================================

/**
 * 智能默认值列表
 */
function SmartDefaultsList({ defaults }: { defaults: SmartDefault[] }) {
  if (defaults.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">AI 自动决定了：</p>
      <ul className="space-y-1.5">
        {defaults.map((d, i) => (
          <SmartDefaultItem key={i} default_={d} />
        ))}
      </ul>
    </div>
  );
}

/**
 * 单个智能默认值项
 */
function SmartDefaultItem({ default_: d }: { default_: SmartDefault }) {
  const sourceLabel = SMART_DEFAULT_SOURCE_LABELS[d.source] || d.source;
  const sourceColor =
    SMART_DEFAULT_SOURCE_COLORS[d.source] || "bg-gray-100 text-gray-600";

  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{formatFieldName(d.field)}:</span>
      <span className="font-medium">{d.value}</span>
      <Badge
        variant="outline"
        className={cn("text-[10px] px-1.5 py-0", sourceColor)}
      >
        {sourceLabel}
      </Badge>
    </li>
  );
}

/**
 * 格式化字段名
 */
function formatFieldName(field: string): string {
  const mapping: Record<string, string> = {
    organizeMethod: "整理方式",
    targetFolder: "目标文件夹",
    scope: "处理范围",
    exportFormat: "导出格式",
    tagAction: "标签操作",
    searchMode: "搜索模式",
  };
  return mapping[field] || field;
}

// ============================================
// 导出
// ============================================

export default TaskResultCard;
