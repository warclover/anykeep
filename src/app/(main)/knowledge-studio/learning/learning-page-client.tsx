"use client";

/**
 * Knowledge Studio - 学习统计客户端组件
 * @description P4 实现 - 内化率追踪与学习统计
 * @version 1.0.0
 * @since 2026-01-02
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  Target,
  Flame,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Clock,
  RefreshCw,
  Minus,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// 类型定义
// ============================================================================

interface MasteryStats {
  userId: string;
  reportsStudied: number;
  pointsMastered: number;
  totalPoints: number;
  overallMasteryRate: number;
  streakDays: number;
  longestStreak: number;
  dueForReview: number;
  weeklyStudyMinutes: number;
  trend: "improving" | "stable" | "declining";
}

interface MasteryDistribution {
  mastered: number;
  proficient: number;
  familiar: number;
  learning: number;
  unknown: number;
}

interface TimelineEntry {
  date: string;
  studyMinutes: number;
  pointsReviewed: number;
  pointsLearned: number;
}

// ============================================================================
// 加载骨架组件
// ============================================================================

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

function DistributionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-12" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-40" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 统计卡片组件
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  progress?: number;
  trend?: "improving" | "stable" | "declining";
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  progress,
  trend,
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {getTrendIcon()}
        </div>
        {progress !== undefined && (
          <Progress value={progress} className="mt-2" />
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 掌握度分布组件
// ============================================================================

interface MasteryDistributionCardProps {
  distribution: MasteryDistribution;
  total: number;
}

function MasteryDistributionCard({
  distribution,
  total,
}: MasteryDistributionCardProps) {
  const levels = [
    { key: "mastered", label: "精通", color: "bg-green-500" },
    { key: "proficient", label: "熟练", color: "bg-blue-500" },
    { key: "familiar", label: "熟悉", color: "bg-yellow-500" },
    { key: "learning", label: "学习中", color: "bg-orange-500" },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          掌握度分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {levels.map(({ key, label, color }) => {
            const count = distribution[key] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm w-16">{label}</span>
                <div className="flex items-center gap-2 flex-1 ml-4">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {count} 个
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {total > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">知识点总数</span>
              <span className="font-medium">{total} 个</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 学习趋势图组件（简化柱状图）
// ============================================================================

interface LearningTrendCardProps {
  timeline: TimelineEntry[];
  loading?: boolean;
}

function LearningTrendCard({ timeline, loading }: LearningTrendCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton
                key={i}
                className="flex-1"
                style={{ height: `${20 + i * 10}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            学习趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">暂无学习数据</h3>
            <p className="text-muted-foreground mt-2">
              开始学习后，这里将显示您的学习趋势
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxMinutes = Math.max(...timeline.map((t) => t.studyMinutes), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          学习趋势（近 7 天）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-32">
          {timeline.slice(-7).map((entry, index) => {
            const height = (entry.studyMinutes / maxMinutes) * 100;
            const date = new Date(entry.date);
            const dayLabel = ["日", "一", "二", "三", "四", "五", "六"][
              date.getDay()
            ];

            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full bg-primary/80 rounded-t transition-all duration-300 hover:bg-primary"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${entry.studyMinutes} 分钟`}
                />
                <span className="text-xs text-muted-foreground">
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          <span>学习时间（分钟）</span>
          <span>
            本周共{" "}
            {timeline.slice(-7).reduce((sum, t) => sum + t.studyMinutes, 0)}{" "}
            分钟
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function LearningPageClient() {
  const [stats, setStats] = useState<MasteryStats | null>(null);
  const [distribution, setDistribution] = useState<MasteryDistribution | null>(
    null,
  );
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取内化率统计
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/knowledge-studio/mastery");
      if (!response.ok) {
        throw new Error("获取统计数据失败");
      }
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      // API 返回的数据结构
      const data = result.data;

      setStats({
        userId: data?.userId || "",
        reportsStudied: data?.reportsStudied || 0,
        pointsMastered: data?.pointsMastered || 0,
        totalPoints: data?.totalPoints || 0,
        overallMasteryRate: data?.overallMasteryRate || 0,
        streakDays: data?.streakDays || 0,
        longestStreak: data?.longestStreak || 0,
        dueForReview: data?.dueForReview || 0,
        weeklyStudyMinutes: data?.weeklyStudyMinutes || 0,
        trend: data?.trend || "stable",
      });

      // 设置分布数据
      if (data?.levelCounts) {
        setDistribution({
          mastered: data.levelCounts.mastered || 0,
          proficient: data.levelCounts.proficient || 0,
          familiar: data.levelCounts.familiar || 0,
          learning: data.levelCounts.learning || 0,
          unknown: data.levelCounts.unknown || 0,
        });
      }

      // 设置时间线数据
      if (data?.timeline && Array.isArray(data.timeline)) {
        setTimeline(data.timeline);
      }
    } catch (err) {
      console.error("Failed to fetch mastery stats:", err);
      // 不抛出错误，设置默认值
      setStats({
        userId: "",
        reportsStudied: 0,
        pointsMastered: 0,
        totalPoints: 0,
        overallMasteryRate: 0,
        streakDays: 0,
        longestStreak: 0,
        dueForReview: 0,
        weeklyStudyMinutes: 0,
        trend: "stable",
      });
      setDistribution({
        mastered: 0,
        proficient: 0,
        familiar: 0,
        learning: 0,
        unknown: 0,
      });
    }
  }, []);

  // 获取待复习数量
  const fetchDueReview = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/knowledge-studio/mastery/review?limit=1",
      );
      if (!response.ok) return;

      const result = await response.json();
      if (result.count !== undefined && stats) {
        setStats((prev) =>
          prev ? { ...prev, dueForReview: result.count } : prev,
        );
      }
    } catch (err) {
      console.error("Failed to fetch due review count:", err);
    }
  }, [stats]);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await fetchStats();
      await fetchDueReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [fetchStats, fetchDueReview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 错误状态
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium">加载失败</h3>
            <p className="text-muted-foreground mt-2">{error}</p>
            <Button onClick={loadData} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">学习统计</h1>
          <p className="text-muted-foreground">
            追踪知识内化率，基于 SM-2 算法优化复习计划
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            刷新
          </Button>
          <Badge variant="outline" className="text-green-600 border-green-600">
            P4 已实现
          </Badge>
        </div>
      </div>

      {/* 内化率概览 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="整体内化率"
              value={`${Math.round(stats?.overallMasteryRate || 0)}%`}
              icon={<Brain className="h-4 w-4 text-muted-foreground" />}
              progress={stats?.overallMasteryRate || 0}
              trend={stats?.trend}
            />
            <StatCard
              title="今日待复习"
              value={stats?.dueForReview || 0}
              subtitle="知识点"
              icon={<Target className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="连续学习"
              value={`${stats?.streakDays || 0} 天`}
              subtitle={`最长 ${stats?.longestStreak || 0} 天`}
              icon={<Flame className="h-4 w-4 text-orange-500" />}
            />
            <StatCard
              title="本周学习"
              value={`${stats?.weeklyStudyMinutes || 0} 分钟`}
              subtitle={`已学习 ${stats?.reportsStudied || 0} 篇草稿`}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
          </>
        )}
      </div>

      {/* 下方内容区 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 掌握度分布 */}
        {loading ? (
          <DistributionSkeleton />
        ) : (
          <MasteryDistributionCard
            distribution={
              distribution || {
                mastered: 0,
                proficient: 0,
                familiar: 0,
                learning: 0,
                unknown: 0,
              }
            }
            total={stats?.totalPoints || 0}
          />
        )}

        {/* 学习趋势 */}
        <LearningTrendCard timeline={timeline} loading={loading} />
      </div>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={!stats?.dueForReview}>
              <Target className="h-4 w-4 mr-2" />
              开始复习 ({stats?.dueForReview || 0})
            </Button>
            <Button variant="outline">
              <BookOpen className="h-4 w-4 mr-2" />
              查看草稿
            </Button>
            <Button variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              详细分析
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
