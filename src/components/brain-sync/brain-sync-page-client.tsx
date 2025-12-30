/**
 * Brain-Sync 复习实验室页面客户端组件
 *
 * 提供完整的复习管理体验：
 * - 复习统计概览
 * - 待复习队列展示
 * - 开始复习会话
 * - 快速访问设置
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
import {
  Brain,
  BookOpen,
  Trophy,
  Clock,
  AlertCircle,
  Settings,
  RefreshCw,
  Loader2,
  Sparkles,
  Calendar,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewSession } from "./review-session";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

interface ReviewStats {
  totalFlashcards: number;
  masteredCount: number;
  learningCount: number;
  pendingCount: number;
  masteredRate: number;
  sessionsInPeriod: number;
  avgResponseTimeMs: number | null;
  streakDays: number;
}

interface QueueStats {
  total: number;
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
}

interface QueueItem {
  flashcardId: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  question: string;
  status: string;
  daysOverdue: number;
}

interface PreferencesData {
  enabled: boolean;
  preferredDay: string;
  preferredTime: string;
  weeklyLimit: number;
}

// ============================================
// 常量
// ============================================

const DAY_LABELS: Record<string, string> = {
  monday: "周一",
  tuesday: "周二",
  wednesday: "周三",
  thursday: "周四",
  friday: "周五",
  saturday: "周六",
  sunday: "周日",
};

// ============================================
// 组件实现
// ============================================

export function BrainSyncPageClient() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [preferences, setPreferences] = useState<PreferencesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // 加载所有数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 并行加载数据
      const [prefsRes, statsRes, queueRes] = await Promise.all([
        fetch("/api/brain-sync/preferences"),
        fetch("/api/brain-sync/stats?timeRange=week"),
        fetch("/api/brain-sync/queue?limit=50"),
      ]);

      const prefsData = await prefsRes.json();
      const statsData = await statsRes.json();
      const queueData = await queueRes.json();

      // 解析偏好设置
      if (prefsData.success && prefsData.data.preferences) {
        setPreferences({
          enabled: prefsData.data.preferences.enabled,
          preferredDay: prefsData.data.preferences.preferredDay,
          preferredTime: prefsData.data.preferences.preferredTime,
          weeklyLimit: prefsData.data.preferences.weeklyLimit,
        });
      }

      // 解析统计数据
      if (statsData.success && statsData.data.stats) {
        const s = statsData.data.stats;
        setStats({
          totalFlashcards: s.totalFlashcards,
          masteredCount: s.masteredCount,
          learningCount: s.learningCount,
          pendingCount: s.pendingCount,
          masteredRate: s.masteredRate,
          sessionsInPeriod: s.sessionsInPeriod,
          avgResponseTimeMs: s.avgResponseTimeMs,
          streakDays: s.streakDays,
        });
      }

      // 解析队列数据
      if (queueData.success && queueData.data) {
        if (queueData.data.stats) {
          setQueueStats({
            total: queueData.data.stats.total ?? 0,
            overdue: queueData.data.stats.overdue ?? 0,
            dueToday: queueData.data.stats.dueToday ?? 0,
            dueTomorrow: queueData.data.stats.dueTomorrow ?? 0,
            // API 返回 upcoming (即将到期)，映射为 dueThisWeek
            dueThisWeek:
              queueData.data.stats.dueThisWeek ??
              queueData.data.stats.upcoming ??
              0,
          });
        }
        if (queueData.data.queue) {
          setQueueItems(
            queueData.data.queue
              .slice(0, 5)
              .map(
                (item: {
                  flashcardId: number;
                  bookmarkId: number;
                  bookmarkTitle: string;
                  bookmarkUrl: string;
                  question: string;
                  status: string;
                  daysOverdue: number;
                }) => ({
                  flashcardId: item.flashcardId,
                  bookmarkId: item.bookmarkId,
                  bookmarkTitle: item.bookmarkTitle,
                  bookmarkUrl: item.bookmarkUrl,
                  question: item.question,
                  status: item.status,
                  daysOverdue: item.daysOverdue,
                }),
              ),
          );
        }
      }
    } catch (err) {
      clientLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to load Brain-Sync data",
      );
      setError("加载数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 复习完成后刷新数据
  const handleSessionComplete = () => {
    setTimeout(loadData, 1000);
  };

  // 未启用状态
  if (!loading && preferences && !preferences.enabled) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-purple-500" />
            <div>
              <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
                复习实验室
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Brain-Sync 智能间隔复习系统
              </p>
            </div>
          </div>
        </header>

        {/* 未启用提示 */}
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                <Brain className="h-8 w-8 text-purple-500" />
              </div>
              <CardTitle>开启 Brain-Sync</CardTitle>
              <CardDescription>
                使用 SM-2 间隔重复算法，科学安排复习计划，帮助您牢固记忆收藏内容
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span>AI 自动生成复习卡片</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span>智能安排复习时间</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <span>追踪学习进度</span>
                </div>
              </div>
              <Button asChild className="w-full">
                <Link href="/settings#brain-sync">
                  <Settings className="mr-2 h-4 w-4" />
                  前往设置启用
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 加载状态
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-muted-foreground">正在加载复习数据...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-purple-500" />
            <div>
              <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
                复习实验室
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Brain-Sync 智能间隔复习系统
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings#brain-sync">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button onClick={() => setReviewOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              开始复习
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 统计概览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">总卡片</p>
                    <p className="text-2xl font-bold">
                      {stats?.totalFlashcards ?? 0}
                    </p>
                  </div>
                  <BookOpen className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">已掌握</p>
                    <p className="text-2xl font-bold text-green-600">
                      {stats?.masteredCount ?? 0}
                    </p>
                  </div>
                  <Trophy className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">待复习</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {queueStats?.total ?? 0}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">连续天数</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {stats?.streakDays ?? 0}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 掌握进度 */}
          {stats && stats.totalFlashcards > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">学习进度</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">掌握率</span>
                    <span className="font-medium">
                      {Math.round(stats.masteredRate * 100)}%
                    </span>
                  </div>
                  <Progress value={stats.masteredRate * 100} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>待学习 {stats.pendingCount}</span>
                    <span>学习中 {stats.learningCount}</span>
                    <span>已掌握 {stats.masteredCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 待复习队列 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">待复习队列</CardTitle>
                {queueStats && queueStats.overdue > 0 && (
                  <Badge variant="destructive">
                    {queueStats.overdue} 张逾期
                  </Badge>
                )}
              </div>
              <CardDescription>
                {queueStats
                  ? `今日 ${queueStats.dueToday ?? 0} 张 · 本周 ${queueStats.dueThisWeek ?? 0} 张`
                  : "暂无待复习卡片"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queueItems.length > 0 ? (
                <div className="space-y-3">
                  {queueItems.map((item, index) => (
                    <div
                      key={`flashcard-${item.flashcardId}-${index}`}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border",
                        item.daysOverdue > 0
                          ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
                          : "bg-muted/50",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {item.bookmarkTitle}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.question}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.daysOverdue > 0 && (
                          <Badge variant="destructive" className="shrink-0">
                            逾期 {item.daysOverdue} 天
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="shrink-0"
                        >
                          <Link
                            href={`/bookmark/${item.bookmarkId}`}
                            target="_blank"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}

                  {queueStats && queueStats.total > 5 && (
                    <p className="text-center text-sm text-muted-foreground pt-2">
                      还有 {queueStats.total - 5} 张卡片待复习
                    </p>
                  )}

                  <Button
                    className="w-full mt-4"
                    onClick={() => setReviewOpen(true)}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    开始复习
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    太棒了！当前没有需要复习的卡片
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 复习计划 */}
          {preferences && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">复习计划</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">首选复习日</p>
                    <p className="font-medium">
                      {DAY_LABELS[preferences.preferredDay] ||
                        preferences.preferredDay}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">首选时间</p>
                    <p className="font-medium">{preferences.preferredTime}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">每周上限</p>
                    <p className="font-medium">{preferences.weeklyLimit} 张</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">本周已复习</p>
                    <p className="font-medium">
                      {stats?.sessionsInPeriod ?? 0} 次
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 复习会话 Dialog */}
      <ReviewSession
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onSessionComplete={handleSessionComplete}
      />
    </div>
  );
}
