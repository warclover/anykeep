"use client";

/**
 * V4.2 月度演化报告卡片
 * 展示 AI 文件夹演化的月度统计和健康度评估
 */

import { useState } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  FolderPlus,
  Scissors,
  Merge,
  HelpCircle,
  ChevronRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

// ============================================================================
// 类型定义
// ============================================================================

export interface MonthlyReport {
  /** 报告月份 YYYY-MM */
  month: string;
  /** 生成时间 */
  generatedAt: string;

  /** 健康度评分 0-100 */
  healthScore: number;
  /** 上月健康度 */
  previousHealthScore: number;

  /** 统计数据 */
  stats: {
    totalFolders: number;
    totalBookmarks: number;
    avgBookmarksPerFolder: number;
    emptyFolders: number;
    lowCohesionFolders: number;
    highSimilarityPairs: number;
  };

  /** 操作统计 */
  operations: {
    foldersCreated: number;
    foldersSplit: number;
    foldersMerged: number;
    bookmarksMoved: number;
  };

  /** 建议列表 */
  recommendations: string[];

  /** 趋势数据 (最近6个月) */
  trends: {
    month: string;
    healthScore: number;
  }[];
}

interface MonthlyReportCardProps {
  report: MonthlyReport | null;
  isLoading?: boolean;
  onRefresh: () => void;
  className?: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

function getHealthBadge(score: number) {
  if (score >= 80) {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        健康
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <AlertCircle className="w-3 h-3 mr-1" />
        一般
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <AlertCircle className="w-3 h-3 mr-1" />
      需改善
    </Badge>
  );
}

function getTrendIcon(current: number, previous: number) {
  const diff = current - previous;
  if (diff > 2) {
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  }
  if (diff < -2) {
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  }
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function getTrendText(current: number, previous: number) {
  const diff = current - previous;
  if (Math.abs(diff) < 1) return "持平";
  const direction = diff > 0 ? "提升" : "下降";
  return `${direction} ${Math.abs(diff).toFixed(1)} 分`;
}

// ============================================================================
// 组件实现
// ============================================================================

export function MonthlyReportCard({
  report,
  isLoading = false,
  onRefresh,
  className,
}: MonthlyReportCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  // 加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 无数据状态
  if (!report) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-indigo-500" />
            月度演化报告
          </CardTitle>
          <CardDescription>AI 分析你的文件夹健康状况</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">暂无报告数据</p>
          <Button variant="outline" onClick={onRefresh}>
            生成本月报告
          </Button>
        </CardContent>
      </Card>
    );
  }

  const monthLabel = format(new Date(report.month + "-01"), "yyyy年M月", {
    locale: zhCN,
  });

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-indigo-500" />
              月度演化报告
              <Badge
                variant="outline"
                className="ml-1 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-xs"
              >
                {monthLabel}
              </Badge>
            </CardTitle>
            {getHealthBadge(report.healthScore)}
          </div>
          <CardDescription className="flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            生成于 {format(new Date(report.generatedAt), "M月d日 HH:mm")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 健康度评分 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">整体健康度</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        健康度评分基于文件夹内聚度、重复度、空文件夹比例等指标综合计算
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{report.healthScore}</span>
                <span className="text-muted-foreground">/100</span>
              </div>
            </div>

            <Progress value={report.healthScore} className="h-2" />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>较上月</span>
              <div className="flex items-center gap-1">
                {getTrendIcon(report.healthScore, report.previousHealthScore)}
                <span>
                  {getTrendText(report.healthScore, report.previousHealthScore)}
                </span>
              </div>
            </div>
          </div>

          {/* 关键指标 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Activity className="w-3 h-3" />
                文件夹总数
              </div>
              <p className="text-xl font-semibold">{report.stats.totalFolders}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText className="w-3 h-3" />
                平均书签数
              </div>
              <p className="text-xl font-semibold">
                {report.stats.avgBookmarksPerFolder.toFixed(1)}
              </p>
            </div>
          </div>

          {/* 本月操作 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              本月 AI 操作
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg border">
                <FolderPlus className="w-4 h-4 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-semibold">
                  {report.operations.foldersCreated}
                </p>
                <p className="text-xs text-muted-foreground">新建</p>
              </div>
              <div className="p-2 rounded-lg border">
                <Scissors className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                <p className="text-lg font-semibold">
                  {report.operations.foldersSplit}
                </p>
                <p className="text-xs text-muted-foreground">分拆</p>
              </div>
              <div className="p-2 rounded-lg border">
                <Merge className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                <p className="text-lg font-semibold">
                  {report.operations.foldersMerged}
                </p>
                <p className="text-xs text-muted-foreground">合并</p>
              </div>
            </div>
          </div>

          {/* 改善建议预览 */}
          {report.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                改善建议
              </h4>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {report.recommendations[0]}
                </p>
                {report.recommendations.length > 1 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    还有 {report.recommendations.length - 1} 条建议
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 查看详情按钮 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowDetail(true)}
          >
            查看完整报告
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              {monthLabel} 演化报告
            </DialogTitle>
            <DialogDescription>
              AI 分析你的文件夹结构健康状况并提供优化建议
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 健康度大卡片 */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium">整体健康度</span>
                {getHealthBadge(report.healthScore)}
              </div>
              <div className="flex items-end gap-4">
                <span className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">
                  {report.healthScore}
                </span>
                <div className="flex items-center gap-1 mb-2">
                  {getTrendIcon(report.healthScore, report.previousHealthScore)}
                  <span className="text-sm text-muted-foreground">
                    {getTrendText(report.healthScore, report.previousHealthScore)}
                  </span>
                </div>
              </div>
              <Progress value={report.healthScore} className="h-3 mt-4" />
            </div>

            {/* 详细统计 */}
            <div className="space-y-3">
              <h3 className="font-medium">详细统计</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatItem
                  label="文件夹总数"
                  value={report.stats.totalFolders}
                />
                <StatItem
                  label="书签总数"
                  value={report.stats.totalBookmarks}
                />
                <StatItem
                  label="平均书签数/文件夹"
                  value={report.stats.avgBookmarksPerFolder.toFixed(1)}
                />
                <StatItem
                  label="空文件夹"
                  value={report.stats.emptyFolders}
                  warning={report.stats.emptyFolders > 5}
                />
                <StatItem
                  label="低内聚文件夹"
                  value={report.stats.lowCohesionFolders}
                  warning={report.stats.lowCohesionFolders > 3}
                />
                <StatItem
                  label="相似文件夹对"
                  value={report.stats.highSimilarityPairs}
                  warning={report.stats.highSimilarityPairs > 2}
                />
              </div>
            </div>

            {/* 本月操作详情 */}
            <div className="space-y-3">
              <h3 className="font-medium">本月 AI 操作</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg border text-center">
                  <FolderPlus className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">
                    {report.operations.foldersCreated}
                  </p>
                  <p className="text-sm text-muted-foreground">新建文件夹</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <Scissors className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold">
                    {report.operations.foldersSplit}
                  </p>
                  <p className="text-sm text-muted-foreground">分拆操作</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <Merge className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">
                    {report.operations.foldersMerged}
                  </p>
                  <p className="text-sm text-muted-foreground">合并操作</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <FileText className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold">
                    {report.operations.bookmarksMoved}
                  </p>
                  <p className="text-sm text-muted-foreground">移动书签</p>
                </div>
              </div>
            </div>

            {/* 趋势图 (简化版) */}
            {report.trends.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">健康度趋势</h3>
                <div className="flex items-end gap-2 h-24">
                  {report.trends.map((t, i) => (
                    <div key={t.month} className="flex-1 flex flex-col items-center">
                      <div
                        className={cn(
                          "w-full rounded-t transition-all",
                          t.healthScore >= 80
                            ? "bg-green-400"
                            : t.healthScore >= 60
                            ? "bg-amber-400"
                            : "bg-red-400"
                        )}
                        style={{ height: `${t.healthScore}%` }}
                      />
                      <span className="text-xs text-muted-foreground mt-1">
                        {format(new Date(t.month + "-01"), "M月")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 完整建议列表 */}
            {report.recommendations.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">改善建议</h3>
                <div className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </span>
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// 统计项子组件
function StatItem({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border",
        warning && "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold",
          warning && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default MonthlyReportCard;
