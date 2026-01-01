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

  // 计算健康率
  const healthRate = stats
    ? Math.round((stats.healthyCount / stats.totalChecked) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* 统计摘要 */}
      {stats && (
        <div className="space-y-3">
          {/* 健康率 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">链接健康率</p>
              <p className="text-2xl font-bold">{healthRate}%</p>
            </div>
            <div
              className={`size-12 rounded-full flex items-center justify-center ${
                healthRate >= 80
                  ? "bg-green-100 text-green-600"
                  : healthRate >= 60
                    ? "bg-amber-100 text-amber-600"
                    : "bg-red-100 text-red-600"
              }`}
            >
              {healthRate >= 80 ? (
                <CheckCircle2 className="size-6" />
              ) : healthRate >= 60 ? (
                <Clock className="size-6" />
              ) : (
                <XCircle className="size-6" />
              )}
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-5 gap-1.5">
            {STAT_CARDS.map((card) => (
              <div
                key={card.key}
                className="text-center p-2 rounded-lg bg-muted/30"
              >
                <div
                  className={`size-2.5 rounded-full ${card.color} mx-auto mb-0.5`}
                />
                <p className="text-[10px] text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-sm font-semibold">{stats[card.key] || 0}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 问题列表 */}
      {problems.length > 0 && (
        <div className="space-y-3">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as ProblemFilter)}
          >
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="all" className="text-xs">
                全部 ({problems.length})
              </TabsTrigger>
              <TabsTrigger value="failed" className="text-xs">
                失效 ({problems.filter((p) => p.status === "failed").length})
              </TabsTrigger>
              <TabsTrigger value="slow" className="text-xs">
                缓慢 ({problems.filter((p) => p.status === "slow").length})
              </TabsTrigger>
              <TabsTrigger value="redirect" className="text-xs">
                重定向 ({problems.filter((p) => p.status === "redirect").length}
                )
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-3">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">链接</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>响应时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProblems.map((problem) => {
                      const statusConfig = STATUS_CONFIG[problem.status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow key={problem.bookmarkId}>
                          <TableCell>
                            <div className="space-y-1">
                              <a
                                href={problem.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline flex items-center gap-1 truncate max-w-[300px]"
                              >
                                {problem.url}
                                <ExternalLink className="size-3 flex-shrink-0" />
                              </a>
                              {problem.errorMessage && (
                                <p className="text-xs text-muted-foreground">
                                  {problem.errorMessage}
                                </p>
                              )}
                              {problem.waybackUrl && (
                                <a
                                  href={problem.waybackUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:underline"
                                >
                                  📚 查看归档版本
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant}>
                              <StatusIcon className="size-3 mr-1" />
                              {statusConfig.label}
                              {problem.httpStatus && ` (${problem.httpStatus})`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {problem.responseTimeMs
                              ? `${problem.responseTimeMs}ms`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onFixProblem(problem)}
                            >
                              <Wrench className="size-4 mr-1" />
                              修复
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredProblems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6">
                          <p className="text-muted-foreground text-sm">
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

      {/* 空状态 */}
      {problems.length === 0 && stats && (
        <div className="text-center py-6">
          <CheckCircle2 className="size-10 mx-auto mb-3 text-green-500" />
          <p className="text-base font-medium">太棒了！所有链接都是健康的</p>
          <p className="text-xs text-muted-foreground">
            共检测 {stats.totalChecked} 个链接，未发现问题
          </p>
        </div>
      )}
    </div>
  );
}
