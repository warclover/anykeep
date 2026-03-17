/**
 * 分类解释面板
 *
 * 展示书签的分类决策理由、匹配方式、备选文件夹
 * 默认折叠为单行摘要，展开后显示完整信息
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Folder,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useClassificationReason } from "@/hooks/bookmark/use-classification-reason";
import { DETAIL_INSIGHTS_TEXT } from "./constants";
import type { ClassificationReason } from "./types";

const TEXT = DETAIL_INSIGHTS_TEXT.classification;

// ============================================================================
// Sub-components
// ============================================================================

/** 置信度徽章 */
function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const variant =
    confidence >= 80
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      : confidence >= 50
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
        variant,
      )}
    >
      {TEXT.confidence} {confidence}%
    </span>
  );
}

/** 因素列表项 */
function FactorItem({
  factor,
}: {
  factor: ClassificationReason["factors"][number];
}) {
  const Icon =
    factor.impact === "positive"
      ? CheckCircle2
      : factor.impact === "negative"
        ? AlertCircle
        : MinusCircle;
  const colorClass =
    factor.impact === "positive"
      ? "text-green-600 dark:text-green-400"
      : factor.impact === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-slate-400 dark:text-slate-500";

  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={cn("size-4 mt-0.5 flex-shrink-0", colorClass)} />
      <div>
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {factor.name}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {" "}
          {factor.value}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ClassificationSkeleton() {
  return (
    <Card className="border-dashed">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ClassificationExplanationProps {
  bookmarkId: number;
  /** 是否存在 classification_result，控制是否发起 API 请求 */
  hasClassificationResult: boolean;
}

export function ClassificationExplanation({
  bookmarkId,
  hasClassificationResult,
}: ClassificationExplanationProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, error } = useClassificationReason(
    bookmarkId,
    hasClassificationResult,
  );

  // 条件不满足或加载失败时不渲染
  if (!hasClassificationResult) return null;
  if (isLoading) return <ClassificationSkeleton />;
  if (error || !data) return null;

  const statusLabel =
    TEXT.status[data.classificationStatus] || data.classificationStatus;

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardContent className="p-0">
        {/* 折叠态：单行摘要 */}
        <button
          type="button"
          className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <Folder className="size-4 text-blue-500 flex-shrink-0" />
            {data.currentFolder ? (
              <span className="text-slate-700 dark:text-slate-200 truncate">
                {TEXT.classifiedTo}
                <span className="font-medium">
                  {" "}
                  「{data.currentFolder.name}」
                </span>
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                {statusLabel}
              </span>
            )}
            <ConfidenceBadge confidence={data.confidence} />
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
              {data.matchSource.label}
            </Badge>
          </div>
          {isExpanded ? (
            <ChevronUp className="size-4 text-slate-400 flex-shrink-0 ml-2" />
          ) : (
            <ChevronDown className="size-4 text-slate-400 flex-shrink-0 ml-2" />
          )}
        </button>

        {/* 展开态：详细信息 */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-slate-100 dark:border-slate-700/50 pt-3">
            {/* 匹配方式说明 */}
            <div className="text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {TEXT.matchSourceLabel}：
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {data.matchSource.description}
              </span>
            </div>

            {/* 相关因素 */}
            {data.factors.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {TEXT.factorsTitle}
                </span>
                {data.factors.map((factor, idx) => (
                  <FactorItem key={idx} factor={factor} />
                ))}
              </div>
            )}

            {/* 备选文件夹 */}
            {data.alternatives.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {TEXT.alternativesTitle}
                </span>
                <div className="space-y-1">
                  {data.alternatives.map((alt) => (
                    <div
                      key={alt.folderId}
                      className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <Folder className="size-3.5 text-slate-400" />
                      <span>{alt.folderName}</span>
                      <ConfidenceBadge confidence={alt.confidence} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
