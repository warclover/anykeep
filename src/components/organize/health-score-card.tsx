/**
 * 健康度评分卡片组件
 *
 * 显示整理健康度分数和统计摘要
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import { Activity, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HealthScoreCardProps {
  healthScore: number;
  totalIssues: number;
  totalSuggestions: number;
  analyzedAt?: Date;
  isAnalyzing?: boolean;
  onReanalyze?: () => void;
  compact?: boolean;
}

/**
 * 获取健康度对应的颜色样式
 */
function getScoreStyles(score: number) {
  if (score >= 80) {
    return {
      badge:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      text: "text-green-600 dark:text-green-400",
      label: "健康",
    };
  }
  if (score >= 60) {
    return {
      badge:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      text: "text-yellow-600 dark:text-yellow-400",
      label: "一般",
    };
  }
  return {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    text: "text-red-600 dark:text-red-400",
    label: "需改进",
  };
}

export function HealthScoreCard({
  healthScore,
  totalIssues,
  totalSuggestions,
  analyzedAt,
  isAnalyzing,
  onReanalyze,
  compact = false,
}: HealthScoreCardProps) {
  const scoreStyles = getScoreStyles(healthScore);

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <div>
            <span className="font-medium">健康度</span>
            <Badge
              variant="secondary"
              className={cn("ml-2", scoreStyles.badge)}
            >
              {healthScore} 分
            </Badge>
          </div>
        </div>
        {totalIssues > 0 && (
          <span className="text-sm text-muted-foreground">
            {totalIssues} 个问题
          </span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            整理健康度
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={scoreStyles.badge}>
              {healthScore} 分 · {scoreStyles.label}
            </Badge>
            {onReanalyze && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onReanalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Progress value={healthScore} className="h-2" />

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className={cn("text-2xl font-bold", scoreStyles.text)}>
                {Math.round(healthScore)}%
              </p>
              <p className="text-xs text-muted-foreground">健康度</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {totalIssues}
              </p>
              <p className="text-xs text-muted-foreground">问题数量</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{totalSuggestions}</p>
              <p className="text-xs text-muted-foreground">优化建议</p>
            </div>
          </div>

          {analyzedAt && (
            <p className="text-xs text-muted-foreground text-right">
              分析时间：{analyzedAt.toLocaleString("zh-CN")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
