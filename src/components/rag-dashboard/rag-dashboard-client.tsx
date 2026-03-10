/**
 * RAG 监控仪表板客户端组件
 *
 * 展示 RAG 系统的实时性能指标
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Activity, Database, Zap, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "./metric-card";
import { LatencyChart } from "./latency-chart";
import { FeatureFlagsPanel } from "./feature-flags-panel";
import { AlertsList } from "./alerts-list";
import { DailyStatsCard } from "./daily-stats-card";
import { cn } from "@/lib/utils";
import { API_MISC } from "@/lib/constants/api-paths";

/**
 * RAG 指标数据类型
 */
interface RAGMetrics {
  searchLatencyP50: number;
  searchLatencyP95: number;
  searchLatencyP99: number;
  searchLatencyAvg: number;
  vectorCacheHitRate: number;
  queryCacheHitRate: number;
  cacheSize: number;
  avgSimilarityScore: number;
  zeroResultRate: number;
  avgResultCount: number;
  embeddingApiCalls: number;
  rerankApiCalls: number;
  llmTokensUsed: number;
  estimatedCostCNY: number;
  periodStart: string;
  periodEnd: string;
}

interface DailyStats {
  date: string;
  totalSearches: number;
  uniqueUsers: number;
  avgLatencyMs: number;
  zeroResultRate: number;
  totalCostCNY: number;
}

interface RAGAlert {
  timestamp: string;
  level: "info" | "warning" | "critical";
  type: string;
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
}

interface FeatureFlags {
  queryRewrite: boolean;
  rerank: boolean;
  vectorCache: boolean;
  parentChildChunking: boolean;
  rrfFusion: boolean;
  smartFilterExtraction: boolean;
}

interface DashboardData {
  metrics: RAGMetrics;
  dailyStats: DailyStats;
  alerts: RAGAlert[];
  featureFlags: FeatureFlags;
  timestamp: string;
}

export function RAGDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(API_MISC.ragMetrics);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "获取指标失败");
      }

      setData(result.data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // 自动刷新（每 30 秒）
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">加载失败</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchMetrics} variant="outline">
            <RefreshCw className="size-4 mr-2" />
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 刷新按钮和最后更新时间 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lastUpdate && (
            <span>最后更新：{lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
        <Button
          onClick={fetchMetrics}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="P95 延迟"
          value={data?.metrics.searchLatencyP95 ?? 0}
          unit="ms"
          icon={Zap}
          loading={loading}
          trend={
            (data?.metrics.searchLatencyP95 ?? 0) > 500
              ? "warning"
              : (data?.metrics.searchLatencyP95 ?? 0) > 1000
                ? "critical"
                : "good"
          }
          description="95% 请求的响应时间"
        />
        <MetricCard
          title="缓存命中率"
          value={(data?.metrics.vectorCacheHitRate ?? 0) * 100}
          unit="%"
          icon={Database}
          loading={loading}
          trend={
            (data?.metrics.vectorCacheHitRate ?? 0) < 0.3
              ? "critical"
              : (data?.metrics.vectorCacheHitRate ?? 0) < 0.5
                ? "warning"
                : "good"
          }
          description="向量缓存命中率"
        />
        <MetricCard
          title="零结果率"
          value={(data?.metrics.zeroResultRate ?? 0) * 100}
          unit="%"
          icon={Activity}
          loading={loading}
          trend={
            (data?.metrics.zeroResultRate ?? 0) > 0.2
              ? "critical"
              : (data?.metrics.zeroResultRate ?? 0) > 0.1
                ? "warning"
                : "good"
          }
          description="搜索无结果的比例"
        />
        <MetricCard
          title="今日成本"
          value={data?.dailyStats.totalCostCNY ?? 0}
          unit="¥"
          icon={DollarSign}
          loading={loading}
          trend={
            (data?.dailyStats.totalCostCNY ?? 0) > 100
              ? "critical"
              : (data?.dailyStats.totalCostCNY ?? 0) > 80
                ? "warning"
                : "good"
          }
          description="今日 API 调用成本"
        />
      </div>

      {/* 延迟图表和每日统计 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LatencyChart
          p50={data?.metrics.searchLatencyP50 ?? 0}
          p95={data?.metrics.searchLatencyP95 ?? 0}
          p99={data?.metrics.searchLatencyP99 ?? 0}
          avg={data?.metrics.searchLatencyAvg ?? 0}
          loading={loading}
        />
        <DailyStatsCard stats={data?.dailyStats ?? null} loading={loading} />
      </div>

      {/* Feature Flags 和告警 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FeatureFlagsPanel
          flags={data?.featureFlags ?? null}
          loading={loading}
        />
        <AlertsList alerts={data?.alerts ?? []} loading={loading} />
      </div>
    </div>
  );
}
