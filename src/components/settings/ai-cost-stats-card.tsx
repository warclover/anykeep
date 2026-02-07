/**
 * AI 成本统计卡片组件
 *
 * 显示 AI 使用的成本、配额和明细信息
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useState } from "react";
import {
  DollarSign,
  Zap,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Crown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAiCostStats,
  type CostBreakdownItem,
} from "@/hooks/domain/ai/use-ai-cost-stats";

// ============================================================================
// 常量
// ============================================================================

const LABELS = {
  title: "AI 使用成本",
  description: "查看 AI 功能的使用情况和费用",
  todayCost: "今日成本",
  monthCost: "本月成本",
  tokenQuota: "Token 配额",
  chatStats: "对话统计",
  todayChats: "今日",
  monthChats: "本月",
  viewBreakdown: "查看成本明细",
  hideBreakdown: "收起明细",
  remaining: "剩余",
  memberTier: "会员等级",
  operation: "操作类型",
  callCount: "调用次数",
  tokens: "消耗 Token",
  cost: "费用",
  noData: "暂无使用记录",
} as const;

const TIER_LABELS: Record<string, string> = {
  free: "免费版",
  basic: "基础版",
  pro: "专业版",
  enterprise: "企业版",
};

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  basic: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  enterprise: "bg-amber-100 text-amber-700",
};

// ============================================================================
// 子组件
// ============================================================================

/**
 * 成本明细表格
 */
function CostBreakdownTable({ breakdown }: { breakdown: CostBreakdownItem[] }) {
  if (breakdown.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        {LABELS.noData}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{LABELS.operation}</TableHead>
          <TableHead className="text-right">{LABELS.callCount}</TableHead>
          <TableHead className="text-right">{LABELS.tokens}</TableHead>
          <TableHead className="text-right">{LABELS.cost}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {breakdown.map((item) => (
          <TableRow key={item.operation}>
            <TableCell className="font-medium">{item.operationLabel}</TableCell>
            <TableCell className="text-right">{item.callCount}</TableCell>
            <TableCell className="text-right">
              {item.tokens.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              ¥{item.cost.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * AI 成本统计卡片
 *
 * 功能：
 * - 显示今日/本月成本
 * - 显示 Token 配额使用情况（环形进度）
 * - 显示对话统计
 * - 可展开的成本明细表格
 * - 显示会员等级信息
 */
export function AiCostStatsCard() {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const {
    dailyCost,
    monthlyCost,
    chatStats,
    quotaStats,
    entitlement,
    breakdown,
    isLoading,
    error,
  } = useAiCostStats();

  // 加载状态
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-12" />
          <Skeleton className="h-8" />
        </CardContent>
      </Card>
    );
  }

  // 错误状态 - 显示默认数据
  if (error) {
    // 静默处理错误，显示空状态
  }

  const quotaPercentage =
    quotaStats.total > 0 ? (quotaStats.used / quotaStats.total) * 100 : 0;
  const remainingTokens = Math.max(0, quotaStats.total - quotaStats.used);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-5 text-emerald-500" />
          {LABELS.title}
        </CardTitle>
        <CardDescription>{LABELS.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 成本概览 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 今日成本 */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="size-4" />
              {LABELS.todayCost}
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ¥{dailyCost.toFixed(2)}
            </div>
          </div>

          {/* 本月成本 */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="size-4" />
              {LABELS.monthCost}
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ¥{monthlyCost.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 配额使用 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1">
              <Zap className="size-4 text-amber-500" />
              {LABELS.tokenQuota}
            </span>
            <span className="text-muted-foreground">
              {quotaStats.used.toLocaleString()} /{" "}
              {quotaStats.total.toLocaleString()}
            </span>
          </div>
          <Progress
            value={quotaPercentage}
            className="h-2"
            aria-label={`Token 配额使用 ${quotaPercentage.toFixed(0)}%`}
          />
          <p className="text-xs text-muted-foreground">
            {LABELS.remaining} {remainingTokens.toLocaleString()} tokens
          </p>
        </div>

        {/* 对话统计 */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm">
            <MessageSquare className="size-4 text-violet-500" />
            {LABELS.chatStats}
          </span>
          <span className="text-sm">
            {LABELS.todayChats}{" "}
            <span className="font-medium">{chatStats.today}</span> 次 /{" "}
            {LABELS.monthChats}{" "}
            <span className="font-medium">{chatStats.month}</span> 次
          </span>
        </div>

        {/* 会员等级 */}
        {entitlement && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Crown className="size-4 text-amber-500" />
                {LABELS.memberTier}
              </span>
              <Badge
                variant="outline"
                className={TIER_COLORS[entitlement.tier] || ""}
              >
                {TIER_LABELS[entitlement.tier] || entitlement.tier}
              </Badge>
            </div>
          </>
        )}

        {/* 成本明细展开 */}
        <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
            >
              {isBreakdownOpen ? (
                <>
                  {LABELS.hideBreakdown}
                  <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  {LABELS.viewBreakdown}
                  <ChevronDown className="size-4" />
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <CostBreakdownTable breakdown={breakdown} />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default AiCostStatsCard;
