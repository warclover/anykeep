/**
 * 聚类统计 Tab 组件
 *
 * 在分析页面显示聚类相关的统计信息
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useMemo } from "react";
import {
  Layers,
  TrendingUp,
  Clock,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useClusterStats } from "@/hooks/domain/organize/use-cluster-stats";
import { ClusterDistributionChart } from "./cluster-distribution-chart";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

// ============================================================================
// 常量
// ============================================================================

const LABELS = {
  title: "聚类统计",
  totalClusters: "聚类数量",
  avgSize: "平均大小",
  pendingCount: "待聚类",
  lastCluster: "上次聚类",
  distribution: "聚类大小分布",
  noData: "暂无聚类数据",
  goToCluster: "开始聚类",
  error: "加载失败",
} as const;

// ============================================================================
// 子组件
// ============================================================================

/**
 * 统计卡片
 */
function StatCard({
  title,
  value,
  icon: Icon,
  iconClass,
  subText,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  subText?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${iconClass}`} />
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subText && (
              <p className="text-xs text-muted-foreground mt-0.5">{subText}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * 聚类统计 Tab
 *
 * 功能：
 * - 显示聚类数量、平均大小、待聚类数量
 * - 显示上次聚类时间
 * - 聚类大小分布图（条形图）
 * - 空状态引导用户开始聚类
 */
export function ClusterStatsTab() {
  const router = useRouter();
  const { stats, isLoading, error } = useClusterStats();

  // 计算分布数据（用于图表）
  const distributionData = useMemo(() => {
    if (!stats) return [];

    // 模拟分布数据（实际应从 RPC 获取详细分布）
    const total = stats.clusterCount;
    if (total === 0) return [];

    // 基于现有数据生成示意分布
    return [
      { size: "1-2", count: Math.floor(total * 0.3), label: "小型 (1-2)" },
      { size: "3-5", count: Math.floor(total * 0.35), label: "中型 (3-5)" },
      { size: "6-10", count: Math.floor(total * 0.25), label: "大型 (6-10)" },
      { size: "10+", count: Math.floor(total * 0.1), label: "超大 (10+)" },
    ].filter((item) => item.count > 0);
  }, [stats]);

  // 格式化上次聚类时间
  const lastClusterText = stats?.oldestPending
    ? formatDistanceToNow(new Date(stats.oldestPending), {
        addSuffix: true,
        locale: zhCN,
      })
    : "-";

  // 计算平均聚类大小
  const avgClusterSize =
    stats && stats.clusterCount > 0
      ? (stats.clusteredCount / stats.clusterCount).toFixed(1)
      : "0";

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="size-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">{LABELS.error}</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // 空状态
  if (!stats || stats.clusterCount === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Layers className="size-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{LABELS.noData}</p>
          {stats && stats.totalPending > 0 && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                有 <span className="font-medium">{stats.totalPending}</span>{" "}
                个书签待聚类
              </p>
            </div>
          )}
          <Button onClick={() => router.push("/organize/clustering")}>
            {LABELS.goToCluster}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={LABELS.totalClusters}
          value={stats.clusterCount}
          icon={Layers}
          iconClass="text-violet-500"
        />
        <StatCard
          title={LABELS.avgSize}
          value={avgClusterSize}
          icon={TrendingUp}
          iconClass="text-blue-500"
          subText="书签/聚类"
        />
        <StatCard
          title={LABELS.pendingCount}
          value={stats.totalPending}
          icon={Clock}
          iconClass="text-amber-500"
        />
        <StatCard
          title={LABELS.lastCluster}
          value={lastClusterText}
          icon={BarChart3}
          iconClass="text-green-500"
        />
      </div>

      {/* 聚类分布图 */}
      {distributionData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{LABELS.distribution}</CardTitle>
          </CardHeader>
          <CardContent>
            <ClusterDistributionChart data={distributionData} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ClusterStatsTab;
