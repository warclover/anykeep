/**
 * 健康诊断面板组件
 *
 * 整合文件夹健康和内容健康两大功能模块
 * 作为整理中心的右侧面板
 *
 * @version 2.0.0 - 集成内容健康检测（原 /health 页面功能）
 * @since 2026-01-31
 * @updated 2026-02-13
 */

"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Loader2, FolderOpen, FileHeart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useLibrarianAnalysis } from "@/hooks/domain/folder/use-librarian-analysis";
import type { LibrarianAnalysis } from "@/types/librarian.types";
import { calculateTotalIssues } from "@/lib/organize/types";
import { HealthScoreCard } from "./health-score-card";
import { ContentHealthTab } from "./content-health-tab";
import {
  IssueSummaryList,
  type IssueType,
  type ActionType,
} from "./issue-summary-list";

// ============================================================================
// 类型定义
// ============================================================================

/** 由父组件传入的分析状态，避免与父组件重复请求同一接口 */
export interface LibrarianPanelState {
  analysis: LibrarianAnalysis | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  runAnalysis: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface HealthDiagnosisPanelProps {
  className?: string;
  /** 由父组件传入时使用，避免重复请求 /api/librarian/analysis */
  analysis?: LibrarianAnalysis | null;
  /** 完整状态由父组件传入时使用（organize 页仅传 analysis，其余用内部 hook 会重复请求，故传完整状态） */
  librarianState?: LibrarianPanelState;
  onViewAllIssues?: () => void;
  onIssueAction?: (type: IssueType, itemId: number, action: ActionType) => void;
  disabled?: boolean;
}

// ============================================================================
// 常量
// ============================================================================

const TAB_FOLDER = "folder";
const TAB_CONTENT = "content";

// ============================================================================
// 主组件
// ============================================================================

export function HealthDiagnosisPanel({
  className,
  analysis: analysisProp,
  librarianState,
  onViewAllIssues,
  onIssueAction,
  disabled,
}: HealthDiagnosisPanelProps) {
  const searchParams = useSearchParams();

  // 从 URL 参数计算初始 Tab（支持从 /health 重定向）
  const initialTab = useMemo(() => {
    const tabParam = searchParams?.get("tab");
    return tabParam === TAB_CONTENT ? TAB_CONTENT : TAB_FOLDER;
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const hookState = useLibrarianAnalysis({
    enabled: !librarianState,
  });

  // 优先使用父组件传入的状态，避免与父组件重复请求
  const analysis =
    librarianState?.analysis ?? analysisProp ?? hookState.analysis;
  const isLoading = librarianState?.isLoading ?? hookState.isLoading;
  const isAnalyzing = librarianState?.isAnalyzing ?? hookState.isAnalyzing;
  const error = librarianState?.error ?? hookState.error;
  const runAnalysis = librarianState?.runAnalysis ?? hookState.runAnalysis;

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

  // 未分析状态（仅文件夹健康需要分析）
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

  // 使用统一的计算函数（避免重复逻辑）
  const totalIssues = calculateTotalIssues(analysis);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-purple-500" />
          健康诊断
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger
              value={TAB_FOLDER}
              className="text-xs gap-1.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/30 dark:data-[state=active]:text-purple-300"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              文件夹健康
            </TabsTrigger>
            <TabsTrigger
              value={TAB_CONTENT}
              className="text-xs gap-1.5 data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 dark:data-[state=active]:bg-cyan-900/30 dark:data-[state=active]:text-cyan-300"
            >
              <FileHeart className="h-3.5 w-3.5" />
              内容健康
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_FOLDER} className="space-y-4 mt-0">
            {/* 健康度评分卡片 */}
            <HealthScoreCard
              healthScore={analysis.healthScore}
              totalIssues={totalIssues}
              totalSuggestions={analysis.totalSuggestions}
              analyzedAt={analysis.analyzedAt}
              isAnalyzing={isAnalyzing}
              onReanalyze={runAnalysis}
              compact={false}
            />

            {/* 问题摘要列表 */}
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
          </TabsContent>

          <TabsContent value={TAB_CONTENT} className="mt-0">
            <ContentHealthTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
