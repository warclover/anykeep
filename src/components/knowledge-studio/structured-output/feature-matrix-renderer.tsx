/**
 * FeatureMatrix 表格渲染器 (Story 3.4)
 * @module knowledge-studio/structured-output
 *
 * 功能对比表格渲染器，以表格形式展示多个对象在各功能维度的对比。
 *
 * 功能特性：
 * - 响应式表格布局
 * - 支持状态图标显示（✓ △ ✗ ?）
 * - 行分类分组
 * - 悬停高亮
 * - 备注展示
 */

"use client";

import React, { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TableIcon, Check, X, Minus, HelpCircle, Info } from "lucide-react";
import type { FeatureMatrixRendererProps } from "./types";
import type { FeatureSupportLevel } from "@/lib/knowledge-studio/blueprint/structured-output";

// ============================================================
// Constants
// ============================================================

/**
 * 支持级别配置
 */
const SUPPORT_LEVEL_CONFIG: Record<
  FeatureSupportLevel,
  {
    icon: React.ReactNode;
    label: string;
    className: string;
  }
> = {
  full: {
    icon: <Check className="size-4" />,
    label: "完全支持",
    className: "text-green-600 dark:text-green-400",
  },
  partial: {
    icon: <Minus className="size-4" />,
    label: "部分支持",
    className: "text-yellow-600 dark:text-yellow-400",
  },
  none: {
    icon: <X className="size-4" />,
    label: "不支持",
    className: "text-red-600 dark:text-red-400",
  },
  unknown: {
    icon: <HelpCircle className="size-4" />,
    label: "未知",
    className: "text-muted-foreground",
  },
};

// ============================================================
// Helper Components
// ============================================================

/**
 * 支持状态单元格
 */
function SupportCell({
  level,
  subjectName,
}: {
  level: FeatureSupportLevel | string;
  subjectName: string;
}) {
  // 检查是否是标准支持级别
  const isStandardLevel = level in SUPPORT_LEVEL_CONFIG;

  if (isStandardLevel) {
    const config = SUPPORT_LEVEL_CONFIG[level as FeatureSupportLevel];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center justify-center",
                config.className,
              )}
            >
              {config.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {subjectName}: {config.label}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 自定义文本
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground truncate max-w-[80px] block">
            {level}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {subjectName}: {level}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 功能行备注
 */
function FeatureNotes({ notes }: { notes: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="size-3 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{notes}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================
// Main Component
// ============================================================

/**
 * FeatureMatrix 表格渲染器
 *
 * 功能对比表格，以表格形式展示多个对象在各功能维度的对比。
 *
 * @example
 * ```tsx
 * <FeatureMatrixRenderer
 *   data={{
 *     meta: { type: 'feature_matrix', ... },
 *     title: '产品功能对比',
 *     subjects: [
 *       { id: 'a', name: 'Pro 版' },
 *       { id: 'b', name: '免费版' },
 *     ],
 *     rows: [
 *       { feature: 'AI 助手', support: { a: 'full', b: 'partial' } },
 *       { feature: '导出功能', support: { a: 'full', b: 'none' } },
 *     ],
 *   }}
 * />
 * ```
 */
export const FeatureMatrixRenderer = memo(function FeatureMatrixRenderer({
  data,
  className,
  maxHeight,
}: FeatureMatrixRendererProps) {
  const { title, subjects, rows, summary } = data;

  // 按分类分组行
  const groupedRows = useMemo(() => {
    const groups: Map<string, typeof rows> = new Map();

    for (const row of rows) {
      const category = row.category ?? "其他";
      const categoryRows = groups.get(category);
      if (categoryRows) {
        categoryRows.push(row);
      } else {
        groups.set(category, [row]);
      }
    }

    return groups;
  }, [rows]);

  // 统计各对象的支持情况
  const supportStats = useMemo(() => {
    const stats: Record<
      string,
      { full: number; partial: number; none: number }
    > = {};

    for (const subject of subjects) {
      stats[subject.id] = { full: 0, partial: 0, none: 0 };
    }

    for (const row of rows) {
      for (const subject of subjects) {
        const level = row.support[subject.id];
        if (level === "full") stats[subject.id].full++;
        else if (level === "partial") stats[subject.id].partial++;
        else if (level === "none") stats[subject.id].none++;
      }
    }

    return stats;
  }, [subjects, rows]);

  // 只有一个分类时不显示分类标题
  const hasMultipleCategories = groupedRows.size > 1;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TableIcon className="size-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {subjects.map((subject) => {
            const stats = supportStats[subject.id];
            return (
              <TooltipProvider key={subject.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">{subject.name}</Badge>
                      <span className="text-xs text-muted-foreground">
                        ({stats.full}/{rows.length})
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      {subject.description && (
                        <p className="font-medium">{subject.description}</p>
                      )}
                      <p className="text-green-500">完全支持: {stats.full}</p>
                      <p className="text-yellow-500">
                        部分支持: {stats.partial}
                      </p>
                      <p className="text-red-500">不支持: {stats.none}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          共 {rows.length} 项功能对比
        </p>
      </CardHeader>

      <CardContent className="p-0">
        <div
          className="overflow-auto"
          style={{ maxHeight: maxHeight ?? "400px" }}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[200px] font-semibold">功能</TableHead>
                {subjects.map((subject) => (
                  <TableHead
                    key={subject.id}
                    className="text-center min-w-[80px]"
                  >
                    {subject.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {Array.from(groupedRows.entries()).map(
                ([category, categoryRows]) => (
                  <React.Fragment key={`group-${category}`}>
                    {/* 分类标题行 */}
                    {hasMultipleCategories && (
                      <TableRow className="bg-muted/50">
                        <TableCell
                          colSpan={subjects.length + 1}
                          className="font-medium text-muted-foreground py-2"
                        >
                          {category}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* 功能行 */}
                    {categoryRows.map((row, rowIndex) => (
                      <TableRow
                        key={`${category}-${rowIndex}`}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            <span>{row.feature}</span>
                            {row.notes && <FeatureNotes notes={row.notes} />}
                          </div>
                        </TableCell>
                        {subjects.map((subject) => (
                          <TableCell key={subject.id} className="text-center">
                            <SupportCell
                              level={row.support[subject.id] ?? "unknown"}
                              subjectName={subject.name}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ),
              )}
            </TableBody>
          </Table>
        </div>

        {/* 总结区域 */}
        {summary && (
          <div className="border-t p-4 bg-muted/20">
            <p className="text-sm text-muted-foreground italic">{summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

FeatureMatrixRenderer.displayName = "FeatureMatrixRenderer";
