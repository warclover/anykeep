/**
 * 规则设置页面客户端组件
 *
 * 统一管理分类规则、自动化流程和系统配置
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { TrendingUp } from "lucide-react";
import {
  Settings,
  RefreshCw,
  Target,
  Zap,
  Clock,
  Sparkles,
  Workflow,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Tab 组件
import { ClassificationRulesTab } from "./tabs/classification-rules-tab";
import { AutomationTab } from "./tabs/automation-tab";
import { ConfigHistoryTab } from "./tabs/config-history-tab";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

interface RulesStats {
  totalBookmarks: number;
  classifiedCount: number;
  pendingCount: number;
  acceptanceRate: number;
  autoClassificationRate: number;
  activeWorkflows: number;
  workflowExecutions: number;
}

// ============================================
// 子组件
// ============================================

/**
 * 统计卡片
 */
interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: typeof TrendingUp;
  colorClass?: string;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  colorClass = "text-purple-600",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
          <div
            className={cn(
              "p-3 rounded-full bg-gray-100 dark:bg-gray-800",
              colorClass,
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// 主组件
// ============================================

export function RulesPageClient() {
  // 状态
  const [activeTab, setActiveTab] = useState("classification");
  const [loading, setLoading] = useState(false);

  // 统计数据
  const [stats, setStats] = useState<RulesStats>({
    totalBookmarks: 0,
    classifiedCount: 0,
    pendingCount: 0,
    acceptanceRate: 0,
    autoClassificationRate: 0,
    activeWorkflows: 0,
    workflowExecutions: 0,
  });

  /**
   * 加载统计数据
   */
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/classification/analytics?type=overview",
      );
      const data = await response.json();

      if (data.success && data.data) {
        setStats((prev) => ({
          ...prev,
          totalBookmarks: data.data.bookmarks?.total || 0,
          classifiedCount: data.data.bookmarks?.classified || 0,
          pendingCount: data.data.bookmarks?.unclassified || 0,
          acceptanceRate: data.data.learning?.acceptanceRate || 0,
          autoClassificationRate: data.data.bookmarks?.classificationRate || 0,
        }));
      }

      // TODO(@backlog): 加载工作流统计
      // const workflowResponse = await fetch("/api/rules/workflows/stats");
    } catch (error) {
      clientLogger.error({ error }, "Failed to load stats:");
      toast.error("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Settings className="size-8 text-purple-600" />
            规则设置
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            管理分类规则、自动化流程和系统配置
          </p>
        </div>
        <Button onClick={loadStats} variant="outline" disabled={loading}>
          <RefreshCw className={cn("mr-2 size-4", loading && "animate-spin")} />
          刷新数据
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="已分类书签"
          value={stats.classifiedCount}
          description="已自动归类的书签数量"
          icon={Target}
          colorClass="text-green-600"
        />
        <StatCard
          title="待分类"
          value={stats.pendingCount}
          description="等待分类的书签"
          icon={Clock}
          colorClass="text-yellow-600"
        />
        <StatCard
          title="自动分类率"
          value={`${stats.autoClassificationRate}%`}
          description="无需人工干预的比例"
          icon={Zap}
          colorClass="text-purple-600"
        />
        <StatCard
          title="活跃工作流"
          value={stats.activeWorkflows}
          description="正在运行的自动化流程"
          icon={Workflow}
          colorClass="text-blue-600"
        />
      </div>

      {/* 主内容区 - 三个 Tab */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="classification" className="gap-2">
            <Sparkles className="size-4" />
            分类规则
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Workflow className="size-4" />
            自动化流程
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <History className="size-4" />
            配置与历史
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 分类规则 */}
        <TabsContent value="classification" className="mt-6">
          <ClassificationRulesTab />
        </TabsContent>

        {/* Tab 2: 自动化流程 */}
        <TabsContent value="automation" className="mt-6">
          <AutomationTab />
        </TabsContent>

        {/* Tab 3: 配置与历史 */}
        <TabsContent value="config" className="mt-6">
          <ConfigHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
