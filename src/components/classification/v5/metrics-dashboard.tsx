/**
 * 智能分类 v5.0 - 指标仪表盘组件
 *
 * 功能：
 * - 显示分类性能指标
 * - 展示 T0/T1 准确率、延迟、成本等
 * - 支持时间范围筛选
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, TrendingDown, Clock, DollarSign, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * 指标摘要类型
 */
interface MetricsSummary {
  days: number;
  totalClassifications: number;
  t0: {
    count: number;
    accuracy: number | null;
    avgLatency: number;
    p95Latency: number;
    avgConfidence: number;
  };
  t1: {
    count: number;
    accuracy: number | null;
    avgLatency: number;
    p95Latency: number;
    avgConfidence: number;
  };
  llmCallRate: number;
  cost: {
    embeddingCost: number;
    llmCost: number;
    totalCost: number;
  };
  degradation: {
    v5Count: number;
    v4Count: number;
    ruleCount: number;
    degradationRate: number;
  };
}

/**
 * 指标仪表盘组件
 */
export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('7');

  /**
   * 加载指标数据
   */
  useEffect(() => {
    async function loadMetrics() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/classification/v5/metrics?days=${timeRange}`);

        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    loadMetrics();
  }, [timeRange]);

  /**
   * 渲染加载状态
   */
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  /**
   * 渲染错误状态
   */
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base">加载失败</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  /**
   * 渲染空状态
   */
  if (!metrics || metrics.totalClassifications === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>分类指标</CardTitle>
          <CardDescription>暂无分类数据</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            开始使用智能分类 v5.0 后，这里将显示性能指标。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和时间范围选择器 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">分类指标</h2>
          <p className="text-muted-foreground">
            智能分类 v5.0 性能监控
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">最近 1 天</SelectItem>
            <SelectItem value="7">最近 7 天</SelectItem>
            <SelectItem value="30">最近 30 天</SelectItem>
            <SelectItem value="90">最近 90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 总分类次数 */}
        <MetricCard
          title="总分类次数"
          value={metrics.totalClassifications.toString()}
          icon={<Target className="h-4 w-4" />}
          description={`${metrics.days} 天内`}
        />

        {/* T0 准确率 */}
        <MetricCard
          title="T0 准确率"
          value={
            metrics.t0.accuracy !== null
              ? `${(metrics.t0.accuracy * 100).toFixed(1)}%`
              : 'N/A'
          }
          icon={<TrendingUp className="h-4 w-4" />}
          description={`${metrics.t0.count} 次分类`}
          trend={metrics.t0.accuracy !== null && metrics.t0.accuracy >= 0.85 ? 'up' : 'down'}
        />

        {/* T0 平均延迟 */}
        <MetricCard
          title="T0 平均延迟"
          value={`${metrics.t0.avgLatency}ms`}
          icon={<Clock className="h-4 w-4" />}
          description={`P95: ${metrics.t0.p95Latency}ms`}
          trend={metrics.t0.avgLatency < 500 ? 'up' : 'down'}
        />

        {/* 总成本 */}
        <MetricCard
          title="总成本"
          value={`$${metrics.cost.totalCost.toFixed(4)}`}
          icon={<DollarSign className="h-4 w-4" />}
          description={`${metrics.days} 天内`}
        />
      </div>

      {/* 详细指标 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* T1 指标 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">T1 LLM 纠正</CardTitle>
            <CardDescription>
              LLM 调用率: {(metrics.llmCallRate * 100).toFixed(1)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow
              label="T1 分类次数"
              value={metrics.t1.count.toString()}
            />
            <MetricRow
              label="T1 准确率"
              value={
                metrics.t1.accuracy !== null
                  ? `${(metrics.t1.accuracy * 100).toFixed(1)}%`
                  : 'N/A'
              }
            />
            <MetricRow
              label="T1 平均延迟"
              value={`${metrics.t1.avgLatency}ms`}
            />
            <MetricRow
              label="T1 平均置信度"
              value={`${(metrics.t1.avgConfidence * 100).toFixed(0)}%`}
            />
          </CardContent>
        </Card>

        {/* 成本和降级 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">成本与降级</CardTitle>
            <CardDescription>
              降级率: {(metrics.degradation.degradationRate * 100).toFixed(1)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow
              label="Embedding 成本"
              value={`$${metrics.cost.embeddingCost.toFixed(4)}`}
            />
            <MetricRow
              label="LLM 成本"
              value={`$${metrics.cost.llmCost.toFixed(4)}`}
            />
            <MetricRow
              label="v5.0 分类"
              value={metrics.degradation.v5Count.toString()}
              badge="success"
            />
            <MetricRow
              label="降级分类"
              value={(metrics.degradation.v4Count + metrics.degradation.ruleCount).toString()}
              badge={metrics.degradation.degradationRate > 0.05 ? 'warning' : 'default'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * 指标卡片组件
 */
function MetricCard({
  title,
  value,
  icon,
  description,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 指标行组件
 */
function MetricRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: 'success' | 'warning' | 'default';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        {badge && (
          <Badge
            variant={badge === 'success' ? 'default' : badge === 'warning' ? 'destructive' : 'outline'}
            className="h-5 px-1.5 text-xs"
          >
            {badge === 'success' && '正常'}
            {badge === 'warning' && '警告'}
          </Badge>
        )}
      </div>
    </div>
  );
}
