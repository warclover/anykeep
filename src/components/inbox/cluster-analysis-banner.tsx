/**
 * V4.2 聚类分析状态横幅
 * 显示在 Inbox 页面顶部，展示 AI 正在分析的书签状态
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Clock, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ClusterStats {
  totalPending: number;
  clusteredCount: number;
  unclusteredCount: number;
  clusterCount: number;
  oldestPending: string | null;
}

interface ClusterAnalysisBannerProps {
  className?: string;
  onStatsLoaded?: (stats: ClusterStats) => void;
}

export function ClusterAnalysisBanner({
  className,
  onStatsLoaded,
}: ClusterAnalysisBannerProps) {
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // 获取聚类统计
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/classification/cluster-stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
        onStatsLoaded?.(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch cluster stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onStatsLoaded]);

  useEffect(() => {
    fetchStats();
    // 每 30 秒刷新一次状态
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 计算等待时间
  const getWaitingTime = (oldestPending: string | null): string => {
    if (!oldestPending) return "刚刚开始";

    const pendingDate = new Date(oldestPending);
    const now = new Date();
    const diffMs = now.getTime() - pendingDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "刚刚开始";
    if (diffMins < 60) return `已等待 ${diffMins} 分钟`;
    if (diffHours < 24) return `已等待 ${diffHours} 小时`;
    return `已等待 ${Math.floor(diffHours / 24)} 天`;
  };

  // 计算进度百分比
  const getProgress = (): number => {
    if (!stats || stats.totalPending === 0) return 0;
    return Math.round((stats.clusteredCount / stats.totalPending) * 100);
  };

  // 如果关闭、加载中、或没有待分析内容，不显示
  if (isDismissed || isLoading || !stats || stats.totalPending === 0) {
    return null;
  }

  const progress = getProgress();
  const waitingTime = getWaitingTime(stats.oldestPending);

  return (
    <div className={cn("relative", className)}>
      <div className="rounded-xl border overflow-hidden transition-all duration-300 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 dark:from-purple-950/30 dark:to-indigo-950/30 dark:border-purple-800">
        {/* 顶部进度条 */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* 图标和文字 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-purple-500 to-indigo-500">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    AI 正在分析 {stats.totalPending} 个书签
                  </h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px]">
                      <p className="text-xs">
                        低置信度的书签会进入观察池，AI 会等待相似内容积累后一起建议创建新文件夹。
                        这样可以提供更精准的分类建议。
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {waitingTime}
                  </span>
                  {stats.clusterCount > 0 && (
                    <span className="text-purple-600 dark:text-purple-400">
                      已识别 {stats.clusterCount} 个聚类
                    </span>
                  )}
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        分析进度
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {progress}%
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />

                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          已聚类
                        </p>
                        <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                          {stats.clusteredCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          等待中
                        </p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {stats.unclusteredCount}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      当聚类达到 3 个或更多相似书签时，AI 会自动建议创建新文件夹。
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    收起
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    详情
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDismissed(true)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              >
                ×
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClusterAnalysisBanner;
