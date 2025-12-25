"use client";

/**
 * 整理执行报告组件
 *
 * 展示整理操作的执行结果，支持撤销操作
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  FileText,
  FolderTree,
  Tags,
  Copy,
  Archive,
  LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrganizeReportProps, OperationResult } from "./types";

// ============================================
// 常量定义
// ============================================

const REPORT_STRINGS = {
  successTitle: "✅ 整理完成",
  failureTitle: "⚠️ 整理部分完成",
  viewDetails: "查看详情",
  undoButton: "撤销",
  undoingButton: "撤销中...",
  closeButton: "关闭",
  duration: (ms: number) => `耗时 ${formatDuration(ms)}`,
  statsLabels: {
    totalProcessed: "处理书签",
    categorizeSuggestions: "移动到文件夹",
    tagSuggestions: "添加标签",
    duplicatesFound: "清理重复",
    archiveCandidates: "归档内容",
    invalidUrls: "失效链接",
  },
} as const;

/**
 * 格式化时长
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
  return `${Math.round(ms / 60000)}分钟`;
}

// ============================================
// 统计项组件
// ============================================

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}

function StatItem({ icon, label, value, highlight }: StatItemProps) {
  if (value === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md",
        highlight ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/50",
      )}
    >
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm">{label}</span>
      <Badge variant="secondary" className="ml-auto">
        {value}
      </Badge>
    </div>
  );
}

// ============================================
// 操作结果列表组件
// ============================================

interface ResultListProps {
  results: OperationResult[];
}

function ResultList({ results }: ResultListProps) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-1 mt-4">
      {results.map((result, index) => (
        <div
          key={result.operationId}
          className={cn(
            "flex items-center justify-between text-sm py-1.5 px-2 rounded",
            result.status === "completed" &&
              "text-green-700 dark:text-green-400",
            result.status === "failed" && "text-red-600 dark:text-red-400",
          )}
        >
          <div className="flex items-center gap-2">
            {result.status === "completed" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            <span>操作 {index + 1}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {result.status === "completed"
              ? `${result.affectedCount} 条`
              : result.error}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// 主组件
// ============================================

/**
 * 整理执行报告组件
 */
export function OrganizeReport({
  report,
  onViewDetails,
  onUndo,
  onClose,
  isUndoing = false,
  className,
}: OrganizeReportProps) {
  const { stats, results, snapshotId, success } = report;
  const hasFailures = results.some((r) => r.status === "failed");
  const canUndo = snapshotId && onUndo;

  return (
    <div className={cn("border rounded-lg p-4 space-y-4", className)}>
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {success && !hasFailures
            ? REPORT_STRINGS.successTitle
            : REPORT_STRINGS.failureTitle}
        </h3>
        <span className="text-xs text-muted-foreground">
          {REPORT_STRINGS.duration(report.totalDuration)}
        </span>
      </div>

      {/* 摘要 */}
      <p className="text-sm text-muted-foreground">{report.summary}</p>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 gap-2">
        <StatItem
          icon={<FolderTree className="w-4 h-4" />}
          label={REPORT_STRINGS.statsLabels.categorizeSuggestions}
          value={stats.categorizeSuggestions}
          highlight
        />
        <StatItem
          icon={<Tags className="w-4 h-4" />}
          label={REPORT_STRINGS.statsLabels.tagSuggestions}
          value={stats.tagSuggestions}
          highlight
        />
        <StatItem
          icon={<Copy className="w-4 h-4" />}
          label={REPORT_STRINGS.statsLabels.duplicatesFound}
          value={stats.duplicatesFound}
        />
        <StatItem
          icon={<Archive className="w-4 h-4" />}
          label={REPORT_STRINGS.statsLabels.archiveCandidates}
          value={stats.archiveCandidates}
        />
        <StatItem
          icon={<LinkIcon className="w-4 h-4" />}
          label={REPORT_STRINGS.statsLabels.invalidUrls}
          value={stats.invalidUrls}
        />
      </div>

      {/* 失败的操作列表 */}
      {hasFailures && (
        <div className="border-t pt-3">
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
            以下操作执行失败：
          </p>
          <ResultList results={results.filter((r) => r.status === "failed")} />
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        {onViewDetails && (
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            <FileText className="w-4 h-4 mr-1" />
            {REPORT_STRINGS.viewDetails}
          </Button>
        )}

        {canUndo && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUndo(snapshotId)}
            disabled={isUndoing}
          >
            {isUndoing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {REPORT_STRINGS.undoingButton}
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-1" />
                {REPORT_STRINGS.undoButton}
              </>
            )}
          </Button>
        )}

        {onClose && (
          <Button size="sm" onClick={onClose} className="ml-auto">
            {REPORT_STRINGS.closeButton}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 简化版报告组件（用于消息流中）
 */
export function OrganizeReportInline({
  report,
  onUndo,
  isUndoing = false,
  className,
}: Omit<OrganizeReportProps, "onViewDetails" | "onClose">) {
  const { stats, snapshotId, success } = report;
  const canUndo = snapshotId && onUndo;

  // 生成简短摘要
  const summaryParts: string[] = [];
  if (stats.categorizeSuggestions > 0) {
    summaryParts.push(`移动 ${stats.categorizeSuggestions} 条到文件夹`);
  }
  if (stats.tagSuggestions > 0) {
    summaryParts.push(`添加 ${stats.tagSuggestions} 条标签`);
  }
  if (stats.duplicatesFound > 0) {
    summaryParts.push(`清理 ${stats.duplicatesFound} 条重复`);
  }

  return (
    <div
      className={cn(
        "border rounded-lg p-4 bg-green-50/50 dark:bg-green-900/10",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-medium text-sm">
              {success ? "整理完成" : "整理部分完成"}
            </span>
          </div>
          <ul className="text-sm text-muted-foreground space-y-0.5">
            {summaryParts.map((part, i) => (
              <li key={i}>• {part}</li>
            ))}
          </ul>
        </div>

        {canUndo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUndo(snapshotId)}
            disabled={isUndoing}
            className="shrink-0"
          >
            {isUndoing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
