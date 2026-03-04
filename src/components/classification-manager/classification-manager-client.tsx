"use client";

import { useState } from "react";
import {
  BrainCircuit,
  RefreshCw,
  Sparkles,
  History,
  Scale,
  Target,
  Clock,
  Zap,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useClassificationData } from "./hooks/use-classification-data";
import { useClassificationConfig } from "./hooks/use-classification-config";
import { StatCard } from "./stat-card";
import { RulesTab } from "./rules-tab";
import { HistoryTab } from "./history-tab";
import { WeightsTab } from "./weights-tab";

export function ClassificationManagerClient() {
  const [activeTab, setActiveTab] = useState("rules");
  const data = useClassificationData();
  const config = useClassificationConfig();

  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <BrainCircuit className="size-8 text-purple-600" />
            分类管理中心
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            管理智能分类规则、查看分类历史、调整分类权重
          </p>
        </div>
        <Button
          onClick={data.loadStats}
          variant="outline"
          disabled={data.loading}
        >
          <RefreshCw
            className={cn("mr-2 size-4", data.loading && "animate-spin")}
          />
          刷新数据
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="已分类书签"
          value={data.stats.classifiedCount}
          description="已自动归类的书签数量"
          icon={Target}
          colorClass="text-green-600"
        />
        <StatCard
          title="待分类"
          value={data.stats.pendingCount}
          description="等待分类的书签"
          icon={Clock}
          colorClass="text-yellow-600"
        />
        <StatCard
          title="自动分类率"
          value={`${data.stats.autoClassificationRate}%`}
          description="无需人工干预的比例"
          icon={Zap}
          colorClass="text-purple-600"
        />
        <StatCard
          title="接受率"
          value={`${data.stats.acceptanceRate}%`}
          description="用户接受建议的比例"
          icon={TrendingUp}
          colorClass="text-blue-600"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="rules" className="gap-2">
            <Sparkles className="size-4" />
            分类规则
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            分类历史
          </TabsTrigger>
          <TabsTrigger value="weights" className="gap-2">
            <Scale className="size-4" />
            权重配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6">
          <RulesTab config={config} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoryTab history={data.history} loading={data.historyLoading} />
        </TabsContent>

        <TabsContent value="weights" className="mt-6">
          <WeightsTab config={config} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
