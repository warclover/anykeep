"use client";

/**
 * V4.2 LLM 使用量和成本监控卡片
 * 展示用户 AI 功能使用统计和成本估算
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Cpu,
  DollarSign,
  RefreshCw,
  HelpCircle,
  Sparkles,
  FolderPlus,
  MessageSquare,
  FileText,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

export interface LLMUsageStats {
  /** 统计周期 */
  period: "daily" | "monthly";
  /** 日期或月份 */
  date: string;

  /** 总调用次数 */
  totalCalls: number;
  /** 总 Token 数 */
  totalTokens: number;
  /** 输入 Token */
  inputTokens: number;
  /** 输出 Token */
  outputTokens: number;
  /** 总成本 (分) */
  totalCostCents: number;

  /** 按操作类型统计 */
  byOperation: {
    classification: { calls: number; tokens: number; costCents: number };
    folderNaming: { calls: number; tokens: number; costCents: number };
    contentAnalysis: { calls: number; tokens: number; costCents: number };
    chat: { calls: number; tokens: number; costCents: number };
  };

  /** 按模型统计 */
  byModel: {
    model: string;
    calls: number;
    tokens: number;
    costCents: number;
  }[];

  /** 配额信息 */
  quota?: {
    dailyLimit: number;
    used: number;
    remaining: number;
  };

  /** 趋势数据 */
  trends?: {
    date: string;
    calls: number;
    costCents: number;
  }[];
}

interface LLMUsageCardProps {
  className?: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

function formatCost(cents: number): string {
  const yuan = Math.max(0, cents) / 100; // 防止负数
  return `¥${yuan.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function getOperationIcon(operation: string) {
  switch (operation) {
    case "classification":
      return <Sparkles className="w-4 h-4 text-indigo-500" />;
    case "folderNaming":
      return <FolderPlus className="w-4 h-4 text-green-500" />;
    case "contentAnalysis":
      return <FileText className="w-4 h-4 text-amber-500" />;
    case "chat":
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
}

function getOperationLabel(operation: string) {
  switch (operation) {
    case "classification":
      return "智能分类";
    case "folderNaming":
      return "文件夹命名";
    case "contentAnalysis":
      return "内容分析";
    case "chat":
      return "AI 对话";
    default:
      return operation;
  }
}

// ============================================================================
// 组件实现
// ============================================================================

export function LLMUsageCard({ className }: LLMUsageCardProps) {
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">("daily");
  const [dailyStats, setDailyStats] = useState<LLMUsageStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<LLMUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dailyRes, monthlyRes] = await Promise.all([
        fetch("/api/llm-usage?period=daily"),
        fetch("/api/llm-usage?period=monthly"),
      ]);

      if (dailyRes.ok) {
        const daily = await dailyRes.json();
        setDailyStats(daily.data);
      }
      if (monthlyRes.ok) {
        const monthly = await monthlyRes.json();
        setMonthlyStats(monthly.data);
      }
    } catch (error) {
      clientLogger.error(
        { error },
        "[LLMUsageCard] Failed to load LLM usage stats",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载 - 仅在组件挂载时执行一次
  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStats = activeTab === "daily" ? dailyStats : monthlyStats;

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
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="size-5 text-cyan-500" />
            AI 使用统计
            <Badge
              variant="outline"
              className="ml-1 bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700 text-cyan-600 dark:text-cyan-300 text-xs"
            >
              V4.2
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadStats}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <CardDescription>监控 AI 功能调用量和成本</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 时间周期切换 */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "daily" | "monthly")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">今日</TabsTrigger>
            <TabsTrigger value="monthly">本月</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {!currentStats ? (
              <div className="text-center py-8">
                <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无使用数据</p>
              </div>
            ) : (
              <>
                {/* 配额使用 (仅日度) */}
                {activeTab === "daily" && currentStats.quota && (
                  <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">今日配额</span>
                      <span>
                        {currentStats.quota.used} /{" "}
                        {currentStats.quota.dailyLimit} 次
                      </span>
                    </div>
                    <Progress
                      value={
                        (currentStats.quota.used /
                          currentStats.quota.dailyLimit) *
                        100
                      }
                      className={cn(
                        "h-2",
                        currentStats.quota.used /
                          currentStats.quota.dailyLimit >
                          0.8 && "[&>div]:bg-amber-500",
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      剩余 {currentStats.quota.remaining} 次调用
                    </p>
                  </div>
                )}

                {/* 主要指标 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-lg border bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Zap className="w-4 h-4" />
                      调用次数
                    </div>
                    <p className="text-2xl font-bold">
                      {currentStats.totalCalls}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4" />
                      估算成本
                    </div>
                    <p className="text-2xl font-bold">
                      {formatCost(currentStats.totalCostCents)}
                    </p>
                  </div>
                </div>

                {/* Token 使用详情 */}
                <div className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Token 使用</span>
                    <span className="font-medium">
                      {formatTokens(currentStats.totalTokens)}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <div className="flex-1 p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                      <span className="text-muted-foreground">输入</span>
                      <p className="font-medium">
                        {formatTokens(currentStats.inputTokens)}
                      </p>
                    </div>
                    <div className="flex-1 p-2 rounded bg-green-50 dark:bg-green-900/20">
                      <span className="text-muted-foreground">输出</span>
                      <p className="font-medium">
                        {formatTokens(currentStats.outputTokens)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 按操作类型 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    按功能
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(currentStats.byOperation).map(
                      ([op, data]) =>
                        data.calls > 0 && (
                          <div
                            key={op}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              {getOperationIcon(op)}
                              <span className="text-sm">
                                {getOperationLabel(op)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-muted-foreground">
                                {data.calls} 次
                              </span>
                              <span className="font-medium w-16 text-right">
                                {formatCost(data.costCents)}
                              </span>
                            </div>
                          </div>
                        ),
                    )}
                  </div>
                </div>

                {/* 按模型 */}
                {currentStats.byModel.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      按模型
                    </h4>
                    <div className="space-y-1">
                      {currentStats.byModel.map((m) => (
                        <div
                          key={m.model}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {m.model}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              {formatTokens(m.tokens)} tokens
                            </span>
                            <span className="font-medium w-16 text-right">
                              {formatCost(m.costCents)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 趋势图 (仅月度) */}
                {activeTab === "monthly" &&
                  currentStats.trends &&
                  currentStats.trends.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        近期趋势
                      </h4>
                      <div className="flex items-end gap-1 h-20">
                        {currentStats.trends.map((t, _i) => {
                          const maxCost = Math.max(
                            ...(currentStats.trends ?? []).map(
                              (x) => x.costCents,
                            ),
                          );
                          const height =
                            maxCost > 0 ? (t.costCents / maxCost) * 100 : 0;
                          return (
                            <TooltipProvider key={t.date}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="flex-1 bg-cyan-400 dark:bg-cyan-600 rounded-t cursor-pointer hover:bg-cyan-500 transition-colors"
                                    style={{
                                      height: `${Math.max(height, 4)}%`,
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {format(new Date(t.date), "M月d日")}
                                  </p>
                                  <p className="text-xs">
                                    {t.calls} 次 · {formatCost(t.costCents)}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* 说明 */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            成本估算基于各模型官方定价计算，实际费用以账单为准。
            免费配额内的使用不计入成本。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default LLMUsageCard;
