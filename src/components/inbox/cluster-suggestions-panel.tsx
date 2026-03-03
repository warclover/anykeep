/**
 * V4.2 聚类建议面板
 * 展示智能分拣服务产生的所有待确认聚类建议
 * 使用 TanStack Query 拉取 inbox?type=suggestions，避免重复请求。
 */

"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Sparkles, Brain, CheckCircle2 } from "lucide-react";
import { ClusterSuggestionCard } from "./cluster-suggestion-card";
import { ClusterProcessingStatusCard } from "./cluster-processing-status";
import { useClusterSuggestions } from "@/hooks/data/use-cluster-suggestions";

interface ClusterSuggestionsPanelProps {
  /** 刷新书签列表回调 */
  onRefreshBookmarks?: () => void;
}

export function ClusterSuggestionsPanel({
  onRefreshBookmarks,
}: ClusterSuggestionsPanelProps) {
  const { suggestions, clusterStatus, isLoading, isFetching, error, refresh } =
    useClusterSuggestions();

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleConfirmed = useCallback(
    (_folderId: number, _folderName: string) => {
      onRefreshBookmarks?.();
      refresh();
    },
    [onRefreshBookmarks, refresh],
  );

  const handleRejected = useCallback(
    (_suggestionId: number) => {
      refresh();
    },
    [refresh],
  );

  // 加载中状态
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 空状态 - 但有处理中的状态
  if (suggestions.length === 0 && clusterStatus) {
    const { pendingClusterCount, nextScheduledAt } = clusterStatus;

    // 如果有待处理的书签
    if (pendingClusterCount > 0) {
      return (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Brain className="h-6 w-6 text-blue-500 animate-pulse" />
            </div>
            <CardTitle className="text-lg">AI 正在分析中</CardTitle>
            <CardDescription>
              {pendingClusterCount} 个书签等待智能分拣
              {nextScheduledAt && (
                <span className="block mt-1 text-xs">
                  下次处理时间:{" "}
                  {new Date(nextScheduledAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw
                className={isFetching ? "animate-spin h-4 w-4" : "h-4 w-4"}
              />
              刷新状态
            </Button>
          </CardContent>
        </Card>
      );
    }

    // 没有待处理也没有建议
    return (
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <CardTitle className="text-lg">暂无聚类建议</CardTitle>
          <CardDescription>
            AI 会在每天凌晨自动分析相似内容并生成整理建议
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // 没有状态也没有建议
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">AI 智能分拣建议</CardTitle>
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
            >
              {suggestions.length} 个待确认
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw
              className={isFetching ? "animate-spin h-4 w-4" : "h-4 w-4"}
            />
          </Button>
        </div>
        <CardDescription>
          AI 发现以下书签可以整理成新的分类，请确认或忽略
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 处理状态 */}
        {clusterStatus && (
          <ClusterProcessingStatusCard status={clusterStatus} />
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 建议列表 */}
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <ClusterSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onConfirmed={(folderId, folderName) =>
                handleConfirmed(folderId, folderName)
              }
              onRejected={() => handleRejected(suggestion.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ClusterSuggestionsPanel;
