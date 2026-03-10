/**
 * 内容健康 Tab 组件
 *
 * 显示内容级别的健康问题（失效链接、重复内容、过期内容）
 * 集成到健康诊断面板中
 *
 * @version 1.0.0
 * @since 2026-02-13
 */

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Activity,
  Link2Off,
  Copy,
  Clock,
  RefreshCw,
  Wrench,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clientLogger } from "@/lib/client-logger";
import { API_MISC } from "@/lib/constants/api-paths";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useHealthOverview } from "@/hooks/domain/health";
import { QuickFixDialog } from "@/components/health/quick-fix/quick-fix-dialog";

// ============================================
// 常量
// ============================================

const TEXT = {
  healthScore: "内容健康",
  scoreUnit: "分",
  brokenLinks: "失效链接",
  duplicates: "重复内容",
  staleContent: "过期内容",
  refreshButton: "重新检测",
  quickFixButton: "一键修复",
  noIssues: "暂无问题",
  loading: "正在加载...",
  clickToExpand: "点击查看详情",
  status: {
    excellent: "优秀",
    good: "良好",
    fair: "一般",
    poor: "需改善",
  },
};

// ============================================
// 获取健康评分样式
// ============================================

function getScoreStyles(score: number) {
  if (score >= 90) {
    return {
      label: TEXT.status.excellent,
      color: "text-green-500",
      bg: "bg-green-500",
      badge:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };
  }
  if (score >= 70) {
    return {
      label: TEXT.status.good,
      color: "text-blue-500",
      bg: "bg-blue-500",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
  }
  if (score >= 50) {
    return {
      label: TEXT.status.fair,
      color: "text-yellow-500",
      bg: "bg-yellow-500",
      badge:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
  }
  return {
    label: TEXT.status.poor,
    color: "text-red-500",
    bg: "bg-red-500",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
}

// ============================================
// 问题快捷卡片组件
// ============================================

interface IssueQuickCardProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  colorClass: string;
  onClick?: () => void;
}

function IssueQuickCard({
  icon,
  label,
  count,
  colorClass,
  onClick,
}: IssueQuickCardProps) {
  const hasIssue = count > 0;

  return (
    <Card
      className={cn(
        "transition-colors",
        hasIssue && onClick && "cursor-pointer hover:bg-accent/50",
      )}
      onClick={hasIssue ? onClick : undefined}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", colorClass)}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold">{count}</span>
              {count === 0 && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// 主组件
// ============================================

interface ContentHealthTabProps {
  className?: string;
}

export function ContentHealthTab({ className }: ContentHealthTabProps) {
  const { overview, isLoading, error, refresh } = useHealthOverview();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQuickFix, setShowQuickFix] = useState(false);
  // 处理重新检测 - 必须在 early return 之前定义
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetch(API_MISC.contentHealth, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ forceRefresh: true }),
      });
      await refresh();
    } catch (err) {
      clientLogger.error({ err }, "Refresh failed");
      toast.error("重新检测失败，请重试");
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  // 处理一键修复完成
  const handleQuickFixComplete = useCallback(() => {
    setShowQuickFix(false);
    refresh();
  }, [refresh]);

  // 数据默认值
  const data = overview || {
    healthScore: 100,
    brokenLinks: 0,
    duplicates: 0,
    staleContent: 0,
    totalIssues: 0,
    lastCheckedAt: null,
  };

  const scoreStyles = getScoreStyles(data.healthScore);
  const hasIssues = data.totalIssues > 0;

  // 加载状态
  if (isLoading) {
    return (
      <div className={cn("py-8 text-center", className)}>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{TEXT.loading}</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className={cn("py-4 text-center", className)}>
        <p className="text-sm text-red-500 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 健康评分概览 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{TEXT.healthScore}</span>
          <Badge variant="secondary" className={scoreStyles.badge}>
            {data.healthScore}
            {TEXT.scoreUnit} · {scoreStyles.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          {hasIssues && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowQuickFix(true)}
            >
              <Wrench className="mr-1 h-3 w-3" />
              {TEXT.quickFixButton}
            </Button>
          )}
        </div>
      </div>

      {/* 评分进度条 */}
      <Progress value={data.healthScore} className="h-2" />

      {/* 问题快捷卡片 */}
      <div className="grid grid-cols-3 gap-2">
        <IssueQuickCard
          icon={<Link2Off className="h-4 w-4 text-white" />}
          label={TEXT.brokenLinks}
          count={data.brokenLinks}
          colorClass="bg-red-500"
        />
        <IssueQuickCard
          icon={<Copy className="h-4 w-4 text-white" />}
          label={TEXT.duplicates}
          count={data.duplicates}
          colorClass="bg-orange-500"
        />
        <IssueQuickCard
          icon={<Clock className="h-4 w-4 text-white" />}
          label={TEXT.staleContent}
          count={data.staleContent}
          colorClass="bg-yellow-500"
        />
      </div>

      {/* 无问题提示 */}
      {!hasIssues && (
        <div className="text-center py-4">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
          <p className="mt-2 text-sm text-muted-foreground">{TEXT.noIssues}</p>
        </div>
      )}

      {/* 上次检测时间 */}
      {data.lastCheckedAt && (
        <p className="text-xs text-muted-foreground text-right">
          上次检测：{new Date(data.lastCheckedAt).toLocaleString("zh-CN")}
        </p>
      )}

      {/* 一键修复对话框 */}
      <QuickFixDialog
        open={showQuickFix}
        onOpenChange={setShowQuickFix}
        overview={data}
        onComplete={handleQuickFixComplete}
      />
    </div>
  );
}
