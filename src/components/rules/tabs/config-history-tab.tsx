/**
 * 配置与历史 Tab 组件
 *
 * 包含：
 * - 权重配置（向量/历史/AI 匹配比例）
 * - 置信度阈值配置
 * - 执行历史（分类记录 + 工作流日志）
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Scale,
  Settings2,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Info,
  Workflow,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CLASSIFICATION_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
  MATCHER_STRATEGY_CONFIG,
} from "@/lib/classification/constants/limits";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

interface WeightConfig {
  vector: number;
  history: number;
  ai: number;
}

interface ClassificationHistoryItem {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  suggestedFolderName: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: string;
}

interface WorkflowLogItem {
  id: string;
  workflowName: string;
  status: "success" | "failed" | "running";
  itemsProcessed: number;
  itemsAffected: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ============================================
// 常量
// ============================================

const WEIGHT_LABELS = {
  vector: { name: "向量匹配", description: "基于语义相似度匹配文件夹" },
  history: { name: "历史匹配", description: "基于用户历史分类行为" },
  ai: { name: "AI 推荐", description: "基于 AI 理解推荐分类" },
};

const STATUS_COLORS = {
  pending:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  accepted:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

const STATUS_LABELS = {
  pending: "待确认",
  accepted: "已接受",
  rejected: "已拒绝",
  expired: "已过期",
};

// ============================================
// 子组件
// ============================================

/**
 * 分类历史项
 */
interface ClassificationHistoryItemProps {
  item: ClassificationHistoryItem;
}

function ClassificationHistoryItemComponent({
  item,
}: ClassificationHistoryItemProps) {
  const StatusIcon =
    item.status === "accepted"
      ? CheckCircle2
      : item.status === "rejected"
        ? XCircle
        : Clock;

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <StatusIcon
        className={cn(
          "size-5 shrink-0",
          item.status === "accepted" && "text-green-500",
          item.status === "rejected" && "text-red-500",
          item.status === "pending" && "text-yellow-500",
          item.status === "expired" && "text-gray-400",
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
          {item.bookmarkTitle}
        </p>
        <p className="text-xs text-gray-500">→ {item.suggestedFolderName}</p>
      </div>
      <div className="text-right shrink-0">
        <Badge
          variant="outline"
          className={cn("text-xs", STATUS_COLORS[item.status])}
        >
          {STATUS_LABELS[item.status]}
        </Badge>
        <p className="text-xs text-gray-400 mt-1">{item.confidence}% 置信度</p>
      </div>
    </div>
  );
}

/**
 * 工作流日志项
 */
interface WorkflowLogItemProps {
  item: WorkflowLogItem;
}

function WorkflowLogItemComponent({ item }: WorkflowLogItemProps) {
  const StatusIcon =
    item.status === "success"
      ? CheckCircle2
      : item.status === "failed"
        ? XCircle
        : RefreshCw;

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <StatusIcon
        className={cn(
          "size-5 shrink-0",
          item.status === "success" && "text-green-500",
          item.status === "failed" && "text-red-500",
          item.status === "running" && "text-blue-500 animate-spin",
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
          {item.workflowName}
        </p>
        <p className="text-xs text-gray-500">
          处理 {item.itemsProcessed} 项，影响 {item.itemsAffected} 项
        </p>
        {item.errorMessage && (
          <p className="text-xs text-red-500 mt-1">{item.errorMessage}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            item.status === "success" &&
              "bg-green-100 text-green-700 dark:bg-green-900/30",
            item.status === "failed" &&
              "bg-red-100 text-red-700 dark:bg-red-900/30",
            item.status === "running" &&
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
          )}
        >
          {item.status === "success"
            ? "成功"
            : item.status === "failed"
              ? "失败"
              : "运行中"}
        </Badge>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(item.startedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export function ConfigHistoryTab() {
  // 权重配置
  const [weights, setWeights] = useState<WeightConfig>({
    vector: CLASSIFICATION_WEIGHTS.VECTOR * 100,
    history: CLASSIFICATION_WEIGHTS.HISTORY * 100,
    ai: CLASSIFICATION_WEIGHTS.AI * 100,
  });

  // 历史记录
  const [classificationHistory, setClassificationHistory] = useState<
    ClassificationHistoryItem[]
  >([]);
  const [workflowLogs, setWorkflowLogs] = useState<WorkflowLogItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState("classification");

  /**
   * 加载分类历史
   */
  const loadClassificationHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(
        "/api/classification/analytics?type=history&limit=50",
      );
      const data = await response.json();

      if (data.success && data.data?.items) {
        setClassificationHistory(data.data.items);
      }
    } catch (error) {
      clientLogger.error({ error }, "Failed to load classification history:");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /**
   * 加载工作流日志
   */
  const loadWorkflowLogs = useCallback(async () => {
    // TODO(@backlog): 从 API 加载工作流执行日志
    // const response = await fetch("/api/rules/workflows/logs?limit=50");
    setWorkflowLogs([]);
  }, []);

  /**
   * 调整权重
   */
  const adjustWeight = (key: keyof WeightConfig, value: number) => {
    setWeights((prev) => {
      const newWeights = { ...prev, [key]: value };

      // 自动调整其他权重以保持总和为 100
      const otherKeys = Object.keys(prev).filter(
        (k) => k !== key,
      ) as (keyof WeightConfig)[];
      const remaining = 100 - value;
      const currentOtherTotal = otherKeys.reduce((sum, k) => sum + prev[k], 0);

      if (currentOtherTotal > 0) {
        otherKeys.forEach((k) => {
          newWeights[k] = Math.round((prev[k] / currentOtherTotal) * remaining);
        });
      }

      return newWeights;
    });
  };

  /**
   * 保存权重配置
   */
  const saveWeights = async () => {
    // 确保权重总和为 100
    const total = weights.vector + weights.history + weights.ai;
    if (Math.abs(total - 100) > 0.1) {
      toast.error("权重总和必须为 100%");
      return;
    }

    try {
      await fetch("/api/classification/weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      toast.success("权重配置已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  // 初始化加载
  useEffect(() => {
    loadClassificationHistory();
    loadWorkflowLogs();
  }, [loadClassificationHistory, loadWorkflowLogs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左侧：权重调整 */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="size-5 text-purple-500" />
              分类权重调整
            </CardTitle>
            <CardDescription>
              调整各匹配策略的权重占比（总和保持 100%）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(Object.keys(weights) as (keyof WeightConfig)[]).map((key) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>{WEIGHT_LABELS[key].name}</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="size-3.5 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{WEIGHT_LABELS[key].description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="text-sm font-medium text-purple-600">
                    {weights[key]}%
                  </span>
                </div>
                <Slider
                  value={[weights[key]]}
                  onValueChange={(v) => adjustWeight(key, v[0])}
                  max={80}
                  min={10}
                  step={5}
                />
              </div>
            ))}

            <Separator />

            {/* 权重可视化 */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-500">权重分布</Label>
              <div className="h-4 w-full flex rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 transition-all"
                  style={{ width: `${weights.vector}%` }}
                />
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${weights.history}%` }}
                />
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${weights.ai}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  向量 {weights.vector}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  历史 {weights.history}%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  AI {weights.ai}%
                </span>
              </div>
            </div>

            <Button onClick={saveWeights} className="w-full mt-4">
              保存权重配置
            </Button>
          </CardContent>
        </Card>

        {/* 当前配置概览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="size-5 text-purple-500" />
              当前配置概览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">高置信度阈值</p>
                <p className="text-lg font-bold text-green-600">
                  ≥{CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE}%
                </p>
                <p className="text-xs text-gray-400">自动归类</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">中置信度阈值</p>
                <p className="text-lg font-bold text-blue-600">
                  {CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE}-
                  {CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE - 1}%
                </p>
                <p className="text-xs text-gray-400">保存建议</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">低置信度阈值</p>
                <p className="text-lg font-bold text-yellow-600">
                  &lt;{CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE}%
                </p>
                <p className="text-xs text-gray-400">放入待整理</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">k-NN 直接匹配</p>
                <p className="text-lg font-bold text-purple-600">
                  ≥
                  {MATCHER_STRATEGY_CONFIG.KNN_DIRECT.SIMILARITY_THRESHOLD *
                    100}
                  %
                </p>
                <p className="text-xs text-gray-400">相似度阈值</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">匹配器权重</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>通用分类匹配</span>
                  <span className="font-medium">
                    {MATCHER_STRATEGY_CONFIG.UNIVERSAL.WEIGHT * 100}%
                  </span>
                </div>
                <Progress
                  value={MATCHER_STRATEGY_CONFIG.UNIVERSAL.WEIGHT * 100}
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>标签匹配</span>
                  <span className="font-medium">
                    {MATCHER_STRATEGY_CONFIG.TAG.WEIGHT * 100}%
                  </span>
                </div>
                <Progress
                  value={MATCHER_STRATEGY_CONFIG.TAG.WEIGHT * 100}
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>指纹匹配</span>
                  <span className="font-medium">
                    {MATCHER_STRATEGY_CONFIG.FINGERPRINT.WEIGHT * 100}%
                  </span>
                </div>
                <Progress
                  value={MATCHER_STRATEGY_CONFIG.FINGERPRINT.WEIGHT * 100}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右侧：执行历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-purple-500" />
            执行历史
          </CardTitle>
          <CardDescription>分类记录和工作流执行日志</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeHistoryTab} onValueChange={setActiveHistoryTab}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="classification" className="gap-2">
                <CheckCircle2 className="size-4" />
                分类记录
              </TabsTrigger>
              <TabsTrigger value="workflow" className="gap-2">
                <Workflow className="size-4" />
                工作流日志
              </TabsTrigger>
            </TabsList>

            <TabsContent value="classification" className="mt-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="size-6 animate-spin text-gray-400" />
                </div>
              ) : classificationHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="size-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">暂无分类历史记录</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {classificationHistory.map((item) => (
                    <ClassificationHistoryItemComponent
                      key={item.id}
                      item={item}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="workflow" className="mt-4">
              {workflowLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Workflow className="size-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">暂无工作流执行记录</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {workflowLogs.map((item) => (
                    <WorkflowLogItemComponent key={item.id} item={item} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
