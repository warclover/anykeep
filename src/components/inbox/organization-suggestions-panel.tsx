"use client";

/**
 * 整理建议面板组件
 * 展示待整理文件夹的智能整理建议列表
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  RefreshCw,
  Sparkles,
  Inbox,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { OrganizationSuggestionCard } from "./organization-suggestion-card";
import { ClusterProcessingStatusCard } from "./cluster-processing-status";
import type { OrganizationAnalysis } from "@/lib/classification";
import { clientLogger } from "@/lib/client-logger";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

interface OrganizationSuggestionsPanelProps {
  /** 初始分析数据 */
  initialAnalysis?: OrganizationAnalysis | null;
  /** 可用文件夹列表 */
  availableFolders?: Array<{ id: number; name: string }>;
  /** 刷新回调 */
  onRefresh?: () => Promise<OrganizationAnalysis>;
  /** 建议应用成功回调 */
  onSuggestionApplied?: () => void;
}

export function OrganizationSuggestionsPanel({
  initialAnalysis,
  availableFolders = [],
  onRefresh,
  onSuggestionApplied,
}: OrganizationSuggestionsPanelProps) {
  const [analysis, setAnalysis] = useState<OrganizationAnalysis | null>(
    initialAnalysis || null,
  );
  const [isLoading, setIsLoading] = useState(!initialAnalysis);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 加载分析数据
  const loadAnalysis = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(API_CLASSIFICATION.inbox);
      if (!response.ok) {
        throw new Error("Failed to load analysis");
      }
      const data = await response.json();
      setAnalysis(data.data);
    } catch (err) {
      setError("加载整理建议失败");
      clientLogger.error(
        { error: err },
        "[OrganizationSuggestionsPanel] Failed to load analysis",
      );
    }
  }, []);

  // 初始加载
  useEffect(() => {
    if (!initialAnalysis) {
      setIsLoading(true);
      loadAnalysis().finally(() => setIsLoading(false));
    }
  }, [initialAnalysis, loadAnalysis]);

  // 刷新分析
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (onRefresh) {
        const newAnalysis = await onRefresh();
        setAnalysis(newAnalysis);
      } else {
        await loadAnalysis();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // 应用建议
  const handleApply = async (
    suggestionId: number,
    _targetFolderId?: number,
  ) => {
    setProcessingIds((prev) => new Set(prev).add(suggestionId));
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(API_CLASSIFICATION.inbox, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to apply suggestion");
      }

      // 从列表中移除已应用的建议
      setAnalysis((prev) =>
        prev
          ? {
              ...prev,
              suggestions: prev.suggestions.filter(
                (s) => s.id !== suggestionId,
              ),
            }
          : null,
      );

      setSuccessMessage("建议已应用");
      onSuggestionApplied?.();
    } catch (err) {
      setError("应用建议失败");
      clientLogger.error(
        { error: err },
        "[OrganizationSuggestionsPanel] Failed to apply suggestion",
      );
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  // 拒绝建议
  const handleReject = async (suggestionId: number) => {
    setProcessingIds((prev) => new Set(prev).add(suggestionId));
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(API_CLASSIFICATION.inbox, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject suggestion");
      }

      // 从列表中移除已拒绝的建议
      setAnalysis((prev) =>
        prev
          ? {
              ...prev,
              suggestions: prev.suggestions.filter(
                (s) => s.id !== suggestionId,
              ),
            }
          : null,
      );

      setSuccessMessage("已忽略该建议");
    } catch (err) {
      setError("操作失败");
      clientLogger.error(
        { error: err },
        "[OrganizationSuggestionsPanel] Failed to reject suggestion",
      );
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  // 一键应用所有建议
  const handleApplyAll = async () => {
    if (!analysis?.suggestions.length) return;

    for (const suggestion of analysis.suggestions) {
      await handleApply(suggestion.id);
    }
  };

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

  // 空状态
  if (!analysis || analysis.suggestions.length === 0) {
    return (
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">暂无整理建议</CardTitle>
          <CardDescription>
            {analysis?.inboxCount
              ? `待整理文件夹有 ${analysis.inboxCount} 个书签，但暂时没有发现明显的整理规律`
              : "待整理文件夹为空"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw
              className={isRefreshing ? "animate-spin h-4 w-4" : "h-4 w-4"}
            />
            重新分析
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">智能整理建议</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={isRefreshing ? "animate-spin h-4 w-4" : "h-4 w-4"}
              />
            </Button>
            {analysis.suggestions.length > 1 && (
              <Button
                size="sm"
                onClick={handleApplyAll}
                disabled={processingIds.size > 0}
              >
                🚀 一键应用所有
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          待整理文件夹有 {analysis.inboxCount} 个书签，发现{" "}
          {analysis.suggestions.length} 个整理机会
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* V4.2: 聚类处理状态 */}
        {analysis.clusterStatus && (
          <ClusterProcessingStatusCard status={analysis.clusterStatus} />
        )}

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 成功提示 */}
        {successMessage && (
          <Alert className="border-green-500 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* 建议列表 */}
        <div className="space-y-4">
          {analysis.suggestions.map((suggestion) => (
            <OrganizationSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              availableFolders={availableFolders}
              onApply={handleApply}
              onReject={handleReject}
              isProcessing={processingIds.has(suggestion.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default OrganizationSuggestionsPanel;
