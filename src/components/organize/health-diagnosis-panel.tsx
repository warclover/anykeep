/**
 * 健康诊断面板组件
 *
 * 整合健康度评分和问题摘要列表，作为整理中心的右侧面板
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLibrarianAnalysis } from "@/hooks/domain/folder/use-librarian-analysis";
import { HealthScoreCard } from "./health-score-card";
import {
  IssueSummaryList,
  type IssueType,
  type ActionType,
} from "./issue-summary-list";

// ============================================================================
// 类型定义
// ============================================================================

interface HealthDiagnosisPanelProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onViewAllIssues?: () => void;
  onIssueAction?: (type: IssueType, itemId: number, action: ActionType) => void;
  disabled?: boolean;
}

// ============================================================================
// 主组件
// ============================================================================

export function HealthDiagnosisPanel({
  className,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  onViewAllIssues,
  onIssueAction,
  disabled,
}: HealthDiagnosisPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const { analysis, isLoading, isAnalyzing, error, runAnalysis } =
    useLibrarianAnalysis();

  // 支持受控和非受控模式
  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            正在加载健康分析...
          </p>
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={runAnalysis}>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 未分析状态
  if (!analysis) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-purple-500" />
            健康诊断
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-4">
            分析文件夹结构，发现优化机会
          </p>
          <Button onClick={runAnalysis} disabled={isAnalyzing} size="sm">
            {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Sparkles className="mr-2 h-4 w-4" />
            开始分析
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 计算问题总数
  const totalIssues =
    analysis.duplicateFolders.length +
    analysis.emptyFolders.length +
    analysis.oversizedFolders.length +
    analysis.poorlyNamedFolders.length +
    analysis.missingCategories.length;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-purple-500" />
            健康诊断
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggle}
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 健康度评分卡片 - 始终显示 */}
        <HealthScoreCard
          healthScore={analysis.healthScore}
          totalIssues={totalIssues}
          totalSuggestions={analysis.totalSuggestions}
          analyzedAt={analysis.analyzedAt}
          isAnalyzing={isAnalyzing}
          onReanalyze={runAnalysis}
          compact={isCollapsed}
        />

        {/* 问题摘要列表 - 可折叠 */}
        {!isCollapsed && (
          <IssueSummaryList
            duplicateFolders={analysis.duplicateFolders}
            emptyFolders={analysis.emptyFolders}
            oversizedFolders={analysis.oversizedFolders}
            poorlyNamedFolders={analysis.poorlyNamedFolders}
            missingCategories={analysis.missingCategories}
            maxItemsPerCategory={2}
            onViewAll={onViewAllIssues}
            onAction={onIssueAction}
            disabled={disabled}
          />
        )}
      </CardContent>
    </Card>
  );
}
