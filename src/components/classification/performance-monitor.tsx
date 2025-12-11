"use client";

/**
 * Classification Performance Monitor
 * V4.2 分类性能监控组件
 *
 * @description 展示分类系统的性能指标
 * - 缓存命中率
 * - 分类准确率
 * - 路由统计
 * - 学习进度
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Zap,
  Target,
  TrendingUp,
  Database,
  Brain,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

interface AnalyticsData {
  overview: {
    bookmarks: { total: number; withFolder: number; withoutFolder: number };
    folders: { total: number; averageBookmarks: number };
    sources: { total: number; averageSamples: number };
  };
  learning: {
    totalEvents: number;
    accuracy: number;
    confirmations: number;
    rejections: number;
    modifications: number;
  };
  cache: {
    hitRate: number;
    size: number;
    hits: number;
    misses: number;
  };
  health: {
    overallScore: number;
    isHealthy: boolean;
    recommendations: string[];
  };
}

interface PerformanceMonitorProps {
  className?: string;
  compact?: boolean;
}

// ============================================================================
// 辅助组件
// ============================================================================

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  status,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  trend?: "up" | "down" | "stable";
  status?: "good" | "warning" | "error";
}) {
  const statusColors = {
    good: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  };

  const statusIcons = {
    good: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
  };

  const StatusIcon = status ? statusIcons[status] : null;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-muted rounded-lg">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
          {StatusIcon && (
            <StatusIcon
              className={cn("w-5 h-5", status && statusColors[status])}
            />
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressCard({
  title,
  value,
  max = 100,
  description,
  status,
}: {
  title: string;
  value: number;
  max?: number;
  description?: string;
  status?: "good" | "warning" | "error";
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const progressColors = {
    good: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{value}%</span>
      </div>
      <Progress
        value={percentage}
        className={cn(
          "h-2",
          status && `[&>div]:${progressColors[status]}`,
        )}
      />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function PerformanceMonitor({
  className,
  compact = false,
}: PerformanceMonitorProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/classification/analytics?type=overview,learning,cache,health");

      if (!res.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const result = await res.json();
      setData(result.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 获取状态评级
  const getAccuracyStatus = (accuracy: number): "good" | "warning" | "error" => {
    if (accuracy >= 80) return "good";
    if (accuracy >= 60) return "warning";
    return "error";
  };

  const getCacheStatus = (hitRate: number): "good" | "warning" | "error" => {
    if (hitRate >= 70) return "good";
    if (hitRate >= 50) return "warning";
    return "error";
  };

  const getHealthStatus = (score: number): "good" | "warning" | "error" => {
    if (score >= 80) return "good";
    if (score >= 60) return "warning";
    return "error";
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-red-200 dark:border-red-800", className)}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // 紧凑模式
  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">分类系统状态</CardTitle>
            <Badge
              variant={data.health.isHealthy ? "default" : "destructive"}
              className="text-xs"
            >
              {data.health.isHealthy ? "正常" : "需关注"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{data.learning.accuracy}%</p>
              <p className="text-xs text-muted-foreground">准确率</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.cache.hitRate}%</p>
              <p className="text-xs text-muted-foreground">缓存命中</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.health.overallScore}</p>
              <p className="text-xs text-muted-foreground">健康分</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 完整模式
  return (
    <div className={cn("space-y-6", className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">分类系统性能监控</h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              更新于 {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          刷新
        </Button>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="分类准确率"
          value={`${data.learning.accuracy}%`}
          icon={Target}
          description={`${data.learning.confirmations} 确认 / ${data.learning.rejections} 拒绝`}
          status={getAccuracyStatus(data.learning.accuracy)}
        />
        <MetricCard
          title="缓存命中率"
          value={`${data.cache.hitRate}%`}
          icon={Zap}
          description={`${data.cache.hits} 命中 / ${data.cache.misses} 未命中`}
          status={getCacheStatus(data.cache.hitRate)}
        />
        <MetricCard
          title="健康评分"
          value={data.health.overallScore}
          icon={TrendingUp}
          description={data.health.isHealthy ? "系统运行正常" : "需要关注"}
          status={getHealthStatus(data.health.overallScore)}
        />
        <MetricCard
          title="学习事件"
          value={data.learning.totalEvents}
          icon={Brain}
          description="累计学习样本数"
        />
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 数据概览 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">数据概览</CardTitle>
            <CardDescription>书签和文件夹统计</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">总书签数</span>
              <Badge variant="outline">{data.overview.bookmarks.total}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">已分类</span>
              <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20">
                {data.overview.bookmarks.withFolder}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">未分类</span>
              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                {data.overview.bookmarks.withoutFolder}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">来源画像</span>
              <Badge variant="outline">{data.overview.sources.total}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* 性能指标 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">性能指标</CardTitle>
            <CardDescription>系统运行状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressCard
              title="分类准确率"
              value={data.learning.accuracy}
              status={getAccuracyStatus(data.learning.accuracy)}
            />
            <ProgressCard
              title="缓存命中率"
              value={data.cache.hitRate}
              status={getCacheStatus(data.cache.hitRate)}
            />
            <ProgressCard
              title="系统健康度"
              value={data.health.overallScore}
              status={getHealthStatus(data.health.overallScore)}
            />
          </CardContent>
        </Card>
      </div>

      {/* 建议 */}
      {data.health.recommendations.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              优化建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.health.recommendations.map((rec, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
