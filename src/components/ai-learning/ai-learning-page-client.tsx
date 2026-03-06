/**
 * AI 学习洞察页面 - 客户端组件
 *
 * 可视化展示 AI 从用户分类行为中学到的偏好和排除规则：
 * - 学习统计概览（事件数、准确率、健康评分）
 * - 排除规则列表（AI 学到的"不应做什么"）
 * - 文件夹偏好排名（AI 理解的内容归属）
 * - 来源偏好（哪些来源偏好哪个文件夹）
 * - 时间段偏好热力图
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BrainCog, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEXT } from "./constants";
import type { InsightsData, AILearningPageClientProps } from "./types";
import { PageHeader, EmptyState } from "./page-header";
import { StatsOverview } from "./stats-overview";
import { OverviewTab } from "./overview-tab";
import { ExclusionsTab } from "./exclusions-tab";
import { FoldersTab } from "./folders-tab";
import { SourcesTab } from "./sources-tab";

// ==================== 主组件 ====================

export function AILearningPageClient({ error }: AILearningPageClientProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(error ?? null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/learning/insights");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "加载失败");
      setData(json.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!error) fetchData();
    else setIsLoading(false);
  }, [error, fetchData]);

  if (loadError) {
    return (
      <div className="container max-w-5xl mx-auto p-4 md:p-6">
        <PageHeader />
        <div className="mt-8 flex flex-col items-center gap-4 text-muted-foreground">
          <AlertCircle className="size-12 opacity-40" />
          <p>{loadError}</p>
          {!error && (
            <Button variant="outline" onClick={fetchData}>
              {TEXT.refresh}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto p-4 md:p-6">
        <PageHeader />
        <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
          <p>{TEXT.loading}</p>
        </div>
      </div>
    );
  }

  const hasAnyData =
    data != null &&
    (data.learningStats.totalEvents > 0 ||
      data.exclusions.length > 0 ||
      (data.preferences?.folderPreferences?.length ?? 0) > 0 ||
      (data.preferences?.sourcePreferences?.length ?? 0) > 0);

  return (
    <div className="container max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader />
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn("size-4 mr-1.5", isLoading && "animate-spin")}
          />
          {TEXT.refresh}
        </Button>
      </div>

      {!data ? (
        <EmptyState />
      ) : (
        <>
          <StatsOverview
            stats={data.learningStats}
            exclusionCount={data.exclusionStats.total}
            healthScore={data.healthReport?.overallScore}
          />

          {!hasAnyData && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-6">
              <BrainCog className="size-10 opacity-20" />
              <p className="text-sm">{TEXT.noDataHint}</p>
            </div>
          )}

          <Tabs
            defaultValue={hasAnyData ? "overview" : "folders"}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">{TEXT.tabs.overview}</TabsTrigger>
              <TabsTrigger value="exclusions">
                {TEXT.tabs.exclusions}
              </TabsTrigger>
              <TabsTrigger value="folders">{TEXT.tabs.folders}</TabsTrigger>
              <TabsTrigger value="sources">{TEXT.tabs.sources}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab
                stats={data.learningStats}
                health={data.healthReport}
                timePreferences={data.preferences?.timePreferences}
              />
            </TabsContent>

            <TabsContent value="exclusions">
              <ExclusionsTab
                exclusions={data.exclusions}
                stats={data.exclusionStats}
                folderPreferences={data.preferences?.folderPreferences}
              />
            </TabsContent>

            <TabsContent value="folders">
              <FoldersTab folders={data.preferences?.folderPreferences ?? []} />
            </TabsContent>

            <TabsContent value="sources">
              <SourcesTab
                sources={data.preferences?.sourcePreferences ?? []}
                folders={data.preferences?.folderPreferences ?? []}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
