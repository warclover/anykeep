/**
 * 整理结果组件
 *
 * 显示整理操作的执行结果，包括：
 * - 执行摘要
 * - 操作统计
 * - 撤销按钮
 * - 建议列表
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { memo, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Undo2,
  FolderOpen,
  Tags,
  Trash2,
  Archive,
  Link2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { OrganizeStats } from "@/lib/ai-skills/skills/batch-organize/types";

// ============================================
// UI 文本常量
// ============================================

const UI_TEXT = {
  title: {
    success: "整理完成",
    partial: "部分完成",
    failed: "整理失败",
  },
  subtitle: {
    success: "已成功整理您的书签",
    partial: "部分操作已完成，部分操作失败",
    failed: "操作未能完成，请稍后重试",
  },
  stats: {
    processed: "已处理",
    categorized: "已分类",
    tagged: "已打标",
    duplicatesRemoved: "已去重",
    archived: "已归档",
    actionsExecuted: "执行操作",
  },
  undo: {
    button: "撤销操作",
    loading: "撤销中...",
    success: "已撤销",
    failed: "撤销失败",
    hint: "可在 24 小时内撤销此操作",
    confirm: "确定要撤销此次整理操作吗？",
  },
  suggestions: {
    title: "后续建议",
  },
} as const;

// ============================================
// 类型定义
// ============================================

export interface OrganizeResultProps {
  /** 是否成功 */
  success: boolean;
  /** 统计信息 */
  stats: OrganizeStats;
  /** 摘要文本 */
  summary: string;
  /** 建议列表 */
  suggestions?: string[];
  /** 快照 ID（用于撤销） */
  snapshotIds?: string[];
  /** 撤销回调 */
  onUndo?: (snapshotIds: string[]) => Promise<boolean>;
  /** 执行时间（毫秒） */
  durationMs?: number;
  /** 生成时间 */
  generatedAt?: string;
  /** 自定义类名 */
  className?: string;
}

export interface UndoState {
  status: "idle" | "loading" | "success" | "failed";
  error?: string;
}

// ============================================
// 辅助组件
// ============================================

/**
 * 统计卡片
 */
const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  colorClass: string;
}) {
  if (value === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 border",
        colorClass,
      )}
    >
      <Icon className="size-4" />
      <div className="flex flex-col">
        <span className="font-semibold">{value}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </div>
  );
});

/**
 * 撤销按钮
 */
const UndoButton = memo(function UndoButton({
  snapshotIds,
  onUndo,
  undoState,
  setUndoState,
}: {
  snapshotIds?: string[];
  onUndo?: (snapshotIds: string[]) => Promise<boolean>;
  undoState: UndoState;
  setUndoState: (state: UndoState) => void;
}) {
  const canUndo =
    snapshotIds &&
    snapshotIds.length > 0 &&
    onUndo &&
    undoState.status !== "success";

  const handleUndo = useCallback(async () => {
    if (!canUndo || !onUndo || !snapshotIds) return;

    // 确认撤销
    const confirmed = window.confirm(UI_TEXT.undo.confirm);
    if (!confirmed) return;

    setUndoState({ status: "loading" });

    try {
      const success = await onUndo(snapshotIds);
      if (success) {
        setUndoState({ status: "success" });
      } else {
        setUndoState({ status: "failed", error: "撤销操作未能完成" });
      }
    } catch (error) {
      setUndoState({
        status: "failed",
        error: error instanceof Error ? error.message : "撤销失败",
      });
    }
  }, [canUndo, onUndo, snapshotIds, setUndoState]);

  if (undoState.status === "success") {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="size-4" />
        <span className="text-sm font-medium">{UI_TEXT.undo.success}</span>
      </div>
    );
  }

  if (undoState.status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-red-600">
          <XCircle className="size-4" />
          <span className="text-sm">
            {undoState.error || UI_TEXT.undo.failed}
          </span>
        </div>
        {canUndo && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            className="ml-2"
          >
            重试
          </Button>
        )}
      </div>
    );
  }

  if (!canUndo) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleUndo}
        disabled={undoState.status === "loading"}
        className="border-orange-200 text-orange-600 hover:bg-orange-50"
      >
        {undoState.status === "loading" ? (
          <>
            <Loader2 className="size-4 mr-1.5 animate-spin" />
            {UI_TEXT.undo.loading}
          </>
        ) : (
          <>
            <Undo2 className="size-4 mr-1.5" />
            {UI_TEXT.undo.button}
          </>
        )}
      </Button>
      <span className="text-xs text-gray-400">{UI_TEXT.undo.hint}</span>
    </div>
  );
});

/**
 * 建议列表
 */
const SuggestionsList = memo(function SuggestionsList({
  suggestions,
}: {
  suggestions: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (suggestions.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors">
          <Lightbulb className="size-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-700">
            {UI_TEXT.suggestions.title}
          </span>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-700 ml-auto"
          >
            {suggestions.length}
          </Badge>
          {isOpen ? (
            <ChevronUp className="size-4 text-amber-500" />
          ) : (
            <ChevronDown className="size-4 text-amber-500" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <ul className="space-y-1.5 pl-4">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-sm text-gray-600"
            >
              <span className="size-1.5 mt-2 rounded-full bg-amber-400 flex-shrink-0" />
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 整理结果组件
 */
export const OrganizeResult = memo(function OrganizeResult({
  success,
  stats,
  summary,
  suggestions = [],
  snapshotIds,
  onUndo,
  durationMs,
  generatedAt,
  className,
}: OrganizeResultProps) {
  const [undoState, setUndoState] = useState<UndoState>({ status: "idle" });

  // 计算结果状态
  const hasFailures = stats.actionsExecuted < stats.totalProcessed;
  const resultStatus = success
    ? hasFailures
      ? "partial"
      : "success"
    : "failed";

  // 状态样式
  const statusConfig = {
    success: {
      icon: CheckCircle2,
      iconClass: "text-green-500",
      bgClass: "from-green-500 to-emerald-500",
      borderClass: "border-green-100",
    },
    partial: {
      icon: AlertTriangle,
      iconClass: "text-yellow-500",
      bgClass: "from-yellow-500 to-orange-500",
      borderClass: "border-yellow-100",
    },
    failed: {
      icon: XCircle,
      iconClass: "text-red-500",
      bgClass: "from-red-500 to-rose-500",
      borderClass: "border-red-100",
    },
  };

  const config = statusConfig[resultStatus];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br from-white to-gray-50/50 overflow-hidden",
        config.borderClass,
        className,
      )}
    >
      {/* 头部 */}
      <div className={cn("px-4 py-3 bg-gradient-to-r", config.bgClass)}>
        <div className="flex items-center gap-2">
          <StatusIcon className="size-5 text-white" />
          <h3 className="text-lg font-semibold text-white">
            {UI_TEXT.title[resultStatus]}
          </h3>
        </div>
        <p className="text-sm text-white/80 mt-0.5">
          {UI_TEXT.subtitle[resultStatus]}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* 摘要 */}
        <div className="text-sm text-gray-700 leading-relaxed">{summary}</div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <StatCard
            icon={FolderOpen}
            label={UI_TEXT.stats.categorized}
            value={stats.categorizeSuggestions}
            colorClass="border-blue-200 text-blue-600"
          />
          <StatCard
            icon={Tags}
            label={UI_TEXT.stats.tagged}
            value={stats.tagSuggestions}
            colorClass="border-purple-200 text-purple-600"
          />
          <StatCard
            icon={Trash2}
            label={UI_TEXT.stats.duplicatesRemoved}
            value={stats.duplicatesFound}
            colorClass="border-amber-200 text-amber-600"
          />
          <StatCard
            icon={Archive}
            label={UI_TEXT.stats.archived}
            value={stats.archiveCandidates}
            colorClass="border-orange-200 text-orange-600"
          />
          <StatCard
            icon={Link2}
            label="失效链接"
            value={stats.invalidUrls}
            colorClass="border-red-200 text-red-600"
          />
        </div>

        {/* 建议列表 */}
        {suggestions.length > 0 && (
          <SuggestionsList suggestions={suggestions} />
        )}

        {/* 元信息 */}
        {(durationMs || generatedAt) && (
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
            {durationMs && (
              <span>耗时 {(durationMs / 1000).toFixed(1)} 秒</span>
            )}
            {generatedAt && (
              <span>
                {new Date(generatedAt).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}

        {/* 撤销按钮 */}
        {success && (
          <div className="pt-3 border-t border-gray-100">
            <UndoButton
              snapshotIds={snapshotIds}
              onUndo={onUndo}
              undoState={undoState}
              setUndoState={setUndoState}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default OrganizeResult;
