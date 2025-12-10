/**
 * V4.2 聚类处理状态指示器
 * 显示 AI 智能分拣的处理进度
 */

"use client";

import { Clock, Brain, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ClusterProcessingStatus } from "@/lib/classification/types/suggestion";

interface ClusterProcessingStatusProps {
  status: ClusterProcessingStatus | null;
  className?: string;
}

/**
 * 聚类处理状态指示器
 */
export function ClusterProcessingStatusCard({
  status,
  className,
}: ClusterProcessingStatusProps) {
  if (!status) return null;

  const {
    pendingClusterCount,
    clusterCount,
    lastProcessedAt,
    nextScheduledAt,
    hasPendingSuggestions,
  } = status;

  // 如果没有待处理的内容，不显示
  if (
    pendingClusterCount === 0 &&
    clusterCount === 0 &&
    !hasPendingSuggestions
  ) {
    return null;
  }

  // 判断状态类型
  const isProcessing = pendingClusterCount > 0;
  const hasResults = clusterCount > 0 || hasPendingSuggestions;

  // 格式化时间
  const formatTime = (date: Date | null): string => {
    if (!date) return "--";
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatRelativeTime = (date: Date | null): string => {
    if (!date) return "";
    const now = new Date();
    const d = new Date(date);
    const diffMs = d.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `约 ${diffHours} 小时后`;
    } else if (diffMinutes > 0) {
      return `约 ${diffMinutes} 分钟后`;
    }
    return "即将执行";
  };

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isProcessing
          ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
          : hasResults
            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
            : "border-gray-200 dark:border-gray-800",
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 状态图标 */}
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isProcessing
                ? "bg-blue-100 dark:bg-blue-900/50"
                : hasResults
                  ? "bg-emerald-100 dark:bg-emerald-900/50"
                  : "bg-gray-100 dark:bg-gray-800",
            )}
          >
            {isProcessing ? (
              <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
            ) : hasResults ? (
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {/* 状态内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {isProcessing
                  ? "AI 智能整理中"
                  : hasPendingSuggestions
                    ? "有新的整理建议"
                    : "智能分拣"}
              </h4>
              {isProcessing && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                >
                  {pendingClusterCount} 个待处理
                </Badge>
              )}
              {hasPendingSuggestions && !isProcessing && (
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  待确认
                </Badge>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {isProcessing
                ? "正在分析内容相似度，将自动归类到合适的文件夹"
                : hasPendingSuggestions
                  ? "AI 发现了可以整理的内容，请查看下方建议"
                  : "所有书签已处理完毕"}
            </p>

            {/* 进度条 - 仅在处理中显示 */}
            {isProcessing && (
              <div className="mb-2">
                <Progress
                  value={30}
                  className="h-1.5 bg-blue-100 dark:bg-blue-900"
                />
              </div>
            )}

            {/* 时间信息 */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              {lastProcessedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  上次: {formatTime(lastProcessedAt)}
                </span>
              )}
              {nextScheduledAt && isProcessing && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  下次: {formatRelativeTime(nextScheduledAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 聚类统计 - 如果有聚类结果 */}
        {clusterCount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                已发现 {clusterCount} 个相似内容组
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                查看建议 →
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ClusterProcessingStatusCard;
