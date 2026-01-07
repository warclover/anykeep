/**
 * Content Diff Viewer - 内容对比查看器
 * @module knowledge-studio/v2
 *
 * P1-5: 反馈优化时展示修改前后对比
 */

"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeftRight,
  Columns2,
  FileText,
  Minus,
  Plus,
  ArrowDown,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface ContentDiffViewerProps {
  /** 原始内容 */
  before: string;
  /** 修改后内容 */
  after: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 最大高度 */
  maxHeight?: string;
  /** 类名 */
  className?: string;
}

interface DiffStats {
  wordsBefore: number;
  wordsAfter: number;
  charsBefore: number;
  charsAfter: number;
  wordsDiff: number;
  charsDiff: number;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 计算中文字数（含中文字符）
 */
function countWords(text: string): number {
  // 中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 英文单词数
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}

/**
 * 计算 Diff 统计
 */
function calculateStats(before: string, after: string): DiffStats {
  const wordsBefore = countWords(before);
  const wordsAfter = countWords(after);
  const charsBefore = before.length;
  const charsAfter = after.length;

  return {
    wordsBefore,
    wordsAfter,
    charsBefore,
    charsAfter,
    wordsDiff: wordsAfter - wordsBefore,
    charsDiff: charsAfter - charsBefore,
  };
}

/**
 * 简单的行级 Diff（用于展示）
 */
function computeLineDiff(
  before: string,
  after: string,
): Array<{
  type: "same" | "removed" | "added" | "modified";
  beforeLine?: string;
  afterLine?: string;
}> {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const result: Array<{
    type: "same" | "removed" | "added" | "modified";
    beforeLine?: string;
    afterLine?: string;
  }> = [];

  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];

    if (beforeLine === undefined) {
      result.push({ type: "added", afterLine });
    } else if (afterLine === undefined) {
      result.push({ type: "removed", beforeLine });
    } else if (beforeLine === afterLine) {
      result.push({ type: "same", beforeLine, afterLine });
    } else {
      result.push({ type: "modified", beforeLine, afterLine });
    }
  }

  return result;
}

// ============================================================
// Component
// ============================================================

export function ContentDiffViewer({
  before,
  after,
  defaultExpanded = false,
  maxHeight = "300px",
  className,
}: ContentDiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");

  const stats = useMemo(() => calculateStats(before, after), [before, after]);
  const lineDiff = useMemo(
    () => computeLineDiff(before, after),
    [before, after],
  );

  // 计算变更数量
  const changedLines = lineDiff.filter(
    (d) => d.type === "added" || d.type === "removed" || d.type === "modified",
  ).length;

  if (!isExpanded) {
    return (
      <div className={cn("rounded-lg border bg-muted/30 p-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">内容对比</span>
            <div className="flex items-center gap-2">
              {stats.wordsDiff !== 0 && (
                <Badge
                  variant={stats.wordsDiff > 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {stats.wordsDiff > 0 ? (
                    <Plus className="h-3 w-3 mr-0.5" />
                  ) : (
                    <Minus className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(stats.wordsDiff)} 字
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {changedLines} 行变更
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="gap-1"
          >
            <ArrowDown className="h-4 w-4" />
            展开对比
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">内容对比</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <FileText className="h-3 w-3" />
            {stats.wordsBefore} → {stats.wordsAfter} 字
          </Badge>
          {stats.wordsDiff !== 0 && (
            <Badge
              variant={stats.wordsDiff > 0 ? "default" : "secondary"}
              className={cn(
                "text-xs",
                stats.wordsDiff > 0
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              )}
            >
              {stats.wordsDiff > 0 ? "+" : ""}
              {stats.wordsDiff}
            </Badge>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "unified" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("unified")}
            className="h-7 px-2"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "split" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("split")}
            className="h-7 px-2"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-7 px-2"
          >
            收起
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea style={{ maxHeight }} className="p-3">
        {viewMode === "unified" ? (
          <UnifiedView lineDiff={lineDiff} />
        ) : (
          <SplitView before={before} after={after} />
        )}
      </ScrollArea>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface UnifiedViewProps {
  lineDiff: ReturnType<typeof computeLineDiff>;
}

function UnifiedView({ lineDiff }: UnifiedViewProps) {
  return (
    <div className="font-mono text-sm space-y-0.5">
      {lineDiff.map((diff, index) => {
        if (diff.type === "same") {
          return (
            <div key={index} className="px-2 py-0.5 text-muted-foreground">
              {diff.beforeLine || "\u00A0"}
            </div>
          );
        }

        if (diff.type === "removed") {
          return (
            <div
              key={index}
              className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded"
            >
              <Minus className="inline h-3 w-3 mr-1" />
              {diff.beforeLine || "\u00A0"}
            </div>
          );
        }

        if (diff.type === "added") {
          return (
            <div
              key={index}
              className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded"
            >
              <Plus className="inline h-3 w-3 mr-1" />
              {diff.afterLine || "\u00A0"}
            </div>
          );
        }

        // Modified
        return (
          <div key={index} className="space-y-0.5">
            <div className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
              <Minus className="inline h-3 w-3 mr-1" />
              {diff.beforeLine || "\u00A0"}
            </div>
            <div className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
              <Plus className="inline h-3 w-3 mr-1" />
              {diff.afterLine || "\u00A0"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SplitViewProps {
  before: string;
  after: string;
}

function SplitView({ before, after }: SplitViewProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <Minus className="h-3 w-3 text-red-500" />
          修改前
        </div>
        <div className="font-mono text-sm whitespace-pre-wrap bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
          {before}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <Plus className="h-3 w-3 text-green-500" />
          修改后
        </div>
        <div className="font-mono text-sm whitespace-pre-wrap bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-200 dark:border-green-800/30">
          {after}
        </div>
      </div>
    </div>
  );
}

export default ContentDiffViewer;
