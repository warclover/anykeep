/**
 * 健康检测页面客户端组件
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Activity,
  Link2Off,
  Copy,
  Clock,
  RefreshCw,
  Wrench,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

import { useHealthOverview } from "@/hooks/domain/health";
import { BrokenLinksTab } from "./broken-links/broken-links-tab";
import { DuplicatesTab } from "./duplicates/duplicates-tab";
import { StaleContentTab } from "./stale-content/stale-content-tab";
import { QuickFixDialog } from "./quick-fix/quick-fix-dialog";

// ============================================
// 文本常量
// ============================================

const PAGE_TEXT = {
  title: "健康检测",
  description: "检测失效链接、重复内容和过期内容，全面诊断收藏夹健康状况",
  refreshButton: "重新检测",
  quickFixButton: "一键修复",
  tabs: {
    brokenLinks: "失效链接",
    duplicates: "重复内容",
    staleContent: "过期内容",
  },
  overview: {
    healthScore: "健康评分",
    brokenLinks: "失效链接",
    duplicates: "重复内容",
    staleContent: "过期内容",
    lastChecked: "上次检测",
    neverChecked: "从未检测",
  },
  status: {
    excellent: "优秀",
    good: "良好",
    fair: "一般",
    poor: "需改善",
  },
};

// ============================================
// 健康评分组件
// ============================================

function HealthScoreCard({ score }: { score: number }) {
  const getScoreInfo = (score: number) => {
    if (score >= 90)
      return {
        label: PAGE_TEXT.status.excellent,
        color: "text-green-500",
        bg: "bg-green-500",
      };
    if (score >= 70)
      return {
        label: PAGE_TEXT.status.good,
        color: "text-blue-500",
        bg: "bg-blue-500",
      };
    if (score >= 50)
      return {
        label: PAGE_TEXT.status.fair,
        color: "text-yellow-500",
        bg: "bg-yellow-500",
      };
    return {
      label: PAGE_TEXT.status.poor,
      color: "text-red-500",
      bg: "bg-red-500",
    };
  };

  const info = getScoreInfo(score);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {PAGE_TEXT.overview.healthScore}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold ${info.color}`}>{score}</span>
          <span className="text-muted-foreground text-sm mb-1">/100</span>
        </div>
        <Progress value={score} className="mt-2 h-2" />
        <p className={`text-sm mt-2 ${info.color}`}>{info.label}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// 统计卡片组件
// ============================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: number;
  onClick?: () => void;
}

function StatCard({ icon, label, value, trend, onClick }: StatCardProps) {
  const isClickable = onClick !== undefined;

  return (
    <Card
      className={
        isClickable ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""
      }
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {value === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 mb-1" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500 mb-1" />
          )}
        </div>
        {trend !== undefined && trend !== 0 && (
          <p
            className={`text-xs mt-1 ${trend > 0 ? "text-red-500" : "text-green-500"}`}
          >
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend)} 本周
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// 主组件
// ============================================

export function HealthPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { overview, isLoading, error, refresh } = useHealthOverview();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQuickFix, setShowQuickFix] = useState(false);

  const activeTab = searchParams?.get("tab") || "broken-links";

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/content-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ forceRefresh: true }),
      });
      await refresh();
      toast.success("检测完成");
    } catch {
      toast.error("检测失败，请重试");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQuickFixComplete = () => {
    setShowQuickFix(false);
    refresh();
    toast.success("修复完成");
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">正在加载...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
            <p className="mt-4 text-lg font-medium">加载失败</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => refresh()} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = overview || {
    healthScore: 100,
    brokenLinks: 0,
    duplicates: 0,
    staleContent: 0,
    totalIssues: 0,
    lastCheckedAt: null,
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {PAGE_TEXT.title}
          </h1>
          <p className="text-muted-foreground mt-1">{PAGE_TEXT.description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {PAGE_TEXT.refreshButton}
          </Button>
          {data.totalIssues > 0 && (
            <Button onClick={() => setShowQuickFix(true)}>
              <Wrench className="mr-2 h-4 w-4" />
              {PAGE_TEXT.quickFixButton}
            </Button>
          )}
        </div>
      </div>

      {/* 健康概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <HealthScoreCard score={data.healthScore} />
        <StatCard
          icon={<Link2Off className="h-4 w-4 text-red-500" />}
          label={PAGE_TEXT.overview.brokenLinks}
          value={data.brokenLinks}
          onClick={() => handleTabChange("broken-links")}
        />
        <StatCard
          icon={<Copy className="h-4 w-4 text-orange-500" />}
          label={PAGE_TEXT.overview.duplicates}
          value={data.duplicates}
          onClick={() => handleTabChange("duplicates")}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-yellow-500" />}
          label={PAGE_TEXT.overview.staleContent}
          value={data.staleContent}
          onClick={() => handleTabChange("stale-content")}
        />
      </div>

      {/* 上次检测时间 */}
      {data.lastCheckedAt && (
        <p className="text-sm text-muted-foreground">
          {PAGE_TEXT.overview.lastChecked}：
          {new Date(data.lastCheckedAt).toLocaleString("zh-CN")}
        </p>
      )}

      {/* Tab 内容 */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="broken-links" className="gap-2">
            <Link2Off className="h-4 w-4" />
            <span>{PAGE_TEXT.tabs.brokenLinks}</span>
            {data.brokenLinks > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                {data.brokenLinks}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-2">
            <Copy className="h-4 w-4" />
            <span>{PAGE_TEXT.tabs.duplicates}</span>
            {data.duplicates > 0 && (
              <span className="ml-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
                {data.duplicates}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stale-content" className="gap-2">
            <Clock className="h-4 w-4" />
            <span>{PAGE_TEXT.tabs.staleContent}</span>
            {data.staleContent > 0 && (
              <span className="ml-1 rounded-full bg-yellow-500 px-2 py-0.5 text-xs text-white">
                {data.staleContent}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broken-links">
          <BrokenLinksTab onUpdate={refresh} />
        </TabsContent>

        <TabsContent value="duplicates">
          <DuplicatesTab onUpdate={refresh} />
        </TabsContent>

        <TabsContent value="stale-content">
          <StaleContentTab onUpdate={refresh} />
        </TabsContent>
      </Tabs>

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
