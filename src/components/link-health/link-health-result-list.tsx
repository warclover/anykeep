/**
 * 链接健康检测结果列表组件
 * 显示统计摘要和问题链接列表
 */

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  XCircle,
  ExternalLink,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import type {
  HealthCheckStats,
  LinkCheckResult,
  HealthStatus,
} from "@/lib/ai-skills/skills/link-health-check/types";

interface LinkHealthResultListProps {
  /** 统计结果 */
  stats: HealthCheckStats | null;
  /** 问题链接列表 */
  problems: LinkCheckResult[];
  /** 修复问题回调 */
  onFixProblem: (problem: LinkCheckResult) => void;
}

/** 状态显示配置 */
const STATUS_CONFIG: Record<
  HealthStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  unknown: {
    label: "未知",
    variant: "outline",
    icon: AlertTriangle,
  },
  healthy: {
    label: "健康",
    variant: "default",
    icon: CheckCircle2,
  },
  slow: {
    label: "缓慢",
    variant: "secondary",
    icon: Clock,
  },
  redirect: {
    label: "重定向",
    variant: "secondary",
    icon: ArrowRightLeft,
  },
  failed: {
    label: "失效",
    variant: "destructive",
    icon: XCircle,
  },
  ignored: {
    label: "已忽略",
    variant: "outline",
    icon: CheckCircle2,
  },
};

/** 统计卡片配置 */
const STAT_CARDS = [
  {
    key: "totalChecked" as const,
    label: "已检测",
    color: "bg-slate-500",
  },
  {
    key: "healthyCount" as const,
    label: "健康",
    color: "bg-green-500",
  },
  {
    key: "slowCount" as const,
    label: "缓慢",
    color: "bg-amber-500",
  },
  {
    key: "redirectCount" as const,
    label: "重定向",
    color: "bg-blue-500",
  },
  {
    key: "failedCount" as const,
    label: "失效",
    color: "bg-red-500",
  },
];

/** 问题标签页过滤器 */
type ProblemFilter = "all" | "failed" | "slow" | "redirect";

export function LinkHealthResultList({
  stats,
  problems,
  onFixProblem,
}: LinkHealthResultListProps) {
  const [filter, setFilter] = useState<ProblemFilter>("all");

  // 过滤问题列表
  const filteredProblems = problems.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  // 计算健康率 - 修正：当没有问题链接时，所有链接都是健康的
  const effectiveHealthyCount =
    problems.length === 0 && stats
      ? stats.totalChecked
      : stats?.healthyCount || 0;

  const healthRate = stats
    ? Math.round((effectiveHealthyCount / stats.totalChecked) * 100)
    : 0;

  // 获取修正后的统计值
  const getStatValue = (key: keyof HealthCheckStats) => {
    if (!stats) return 0;
    // 当没有问题链接时，健康数等于已检测数
    if (key === "healthyCount" && problems.length === 0) {
      return stats.totalChecked;
    }
    return stats[key] || 0;
  };

  return (
    <div className="space-y-2">
      {/* 空状态 - 所有链接健康时显示简洁成功消息 */}
      {problems.length === 0 && stats && (
        <div className="space-y-2">
          {/* 成功消息行 */}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-500" />
            <div>
              <span className="text-sm font-medium">
                太棒了！所有链接都是健康的
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                共检测 {stats.totalChecked} 个链接，未发现问题
              </span>
            </div>
          </div>

          {/* 统计行 */}
          <div className="flex items-center gap-4 p-2 rounded-lg bg-muted/30">
            {/* 健康率 */}
            <div className="flex items-center gap-1.5">
              <div className="size-6 rounded-full flex items-center justify-center bg-green-100 text-green-600">
                <CheckCircle2 className="size-3.5" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-muted-foreground">
                  健康率
                </span>
                <span className="text-base font-bold">{healthRate}%</span>
              </div>
            </div>

            {/* 统计卡片 - 横向排列 */}
            <div className="flex-1 flex justify-around">
              {STAT_CARDS.map((card) => (
                <div key={card.key} className="flex items-center gap-1">
                  <div className={`size-2 rounded-full ${card.color}`} />
                  <span className="text-[10px] text-muted-foreground">
                    {card.label}
                  </span>
                  <span className="text-sm font-semibold">
                    {getStatValue(card.key)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 有问题时显示统计摘要 */}
      {problems.length > 0 && stats && (
        <div className="flex items-center gap-4 p-2 rounded-lg bg-muted/30">
          {/* 健康率 */}
          <div className="flex items-center gap-1.5">
            <div
              className={`size-6 rounded-full flex items-center justify-center ${
                healthRate >= 80
                  ? "bg-green-100 text-green-600"
                  : healthRate >= 60
                    ? "bg-amber-100 text-amber-600"
                    : "bg-red-100 text-red-600"
              }`}
            >
              {healthRate >= 80 ? (
                <CheckCircle2 className="size-3.5" />
              ) : healthRate >= 60 ? (
                <Clock className="size-3.5" />
              ) : (
                <XCircle className="size-3.5" />
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-muted-foreground">健康率</span>
              <span className="text-base font-bold">{healthRate}%</span>
            </div>
          </div>

          {/* 统计卡片 - 横向排列 */}
          <div className="flex-1 flex justify-around">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className="flex items-center gap-1">
                <div className={`size-2 rounded-full ${card.color}`} />
                <span className="text-[10px] text-muted-foreground">
                  {card.label}
                </span>
                <span className="text-sm font-semibold">
                  {getStatValue(card.key)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 问题列表 */}
      {problems.length > 0 && (
        <div className="space-y-2">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as ProblemFilter)}
          >
            <TabsList className="grid w-full grid-cols-4 h-7">
              <TabsTrigger value="all" className="text-[11px] py-1">
                全部 ({problems.length})
              </TabsTrigger>
              <TabsTrigger value="failed" className="text-[11px] py-1">
                失效 ({problems.filter((p) => p.status === "failed").length})
              </TabsTrigger>
              <TabsTrigger value="slow" className="text-[11px] py-1">
                缓慢 ({problems.filter((p) => p.status === "slow").length})
              </TabsTrigger>
              <TabsTrigger value="redirect" className="text-[11px] py-1">
                重定向 ({problems.filter((p) => p.status === "redirect").length}
                )
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-2">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="h-8">
                      <TableHead className="w-[50%] py-1.5 text-xs">
                        链接
                      </TableHead>
                      <TableHead className="py-1.5 text-xs">状态</TableHead>
                      <TableHead className="py-1.5 text-xs">响应</TableHead>
                      <TableHead className="text-right py-1.5 text-xs">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProblems.map((problem) => {
                      const statusConfig = STATUS_CONFIG[problem.status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow key={problem.bookmarkId} className="h-10">
                          <TableCell className="py-1.5">
                            <div className="space-y-0.5">
                              <a
                                href={problem.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium hover:underline flex items-center gap-1 truncate max-w-[280px]"
                              >
                                {problem.url}
                                <ExternalLink className="size-2.5 flex-shrink-0" />
                              </a>
                              {problem.errorMessage && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                                  {problem.errorMessage}
                                </p>
                              )}
                              {problem.waybackUrl && (
                                <a
                                  href={problem.waybackUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-500 hover:underline"
                                >
                                  📚 归档
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Badge
                              variant={statusConfig.variant}
                              className="text-[10px] px-1.5 py-0"
                            >
                              <StatusIcon className="size-2.5 mr-0.5" />
                              {statusConfig.label}
                              {problem.httpStatus && ` ${problem.httpStatus}`}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1.5 text-xs">
                            {problem.responseTimeMs
                              ? `${problem.responseTimeMs}ms`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right py-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => onFixProblem(problem)}
                            >
                              <Wrench className="size-3 mr-1" />
                              修复
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredProblems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          <p className="text-muted-foreground text-xs">
                            没有符合条件的问题链接
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
