/**
 * 分类管理页面客户端组件
 *
 * 提供智能分类系统的完整管理界面
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit,
  Settings2,
  History,
  Scale,
  RefreshCw,
  TrendingUp,
  Target,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  UNIVERSAL_CATEGORIES,
  CATEGORY_GROUP_NAMES,
  type CategoryGroup,
  type UniversalCategory,
} from "@/lib/classification/constants/universal-categories";
import {
  CLASSIFICATION_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
  MATCHER_STRATEGY_CONFIG,
} from "@/lib/classification/constants/limits";

// ============================================
// 类型定义
// ============================================

interface ClassificationStats {
  totalBookmarks: number;
  classifiedCount: number;
  pendingCount: number;
  acceptanceRate: number;
  autoClassificationRate: number;
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

interface WeightConfig {
  vector: number;
  history: number;
  ai: number;
}

interface ThresholdConfig {
  high: number;
  medium: number;
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
 * 统计卡片
 */
interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: typeof TrendingUp;
  trend?: { value: number; isPositive: boolean };
  colorClass?: string;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
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
        {trend && (
          <div
            className={cn(
              "mt-2 text-xs",
              trend.isPositive ? "text-green-600" : "text-red-600",
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% 较上周
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 分类规则卡片
 */
interface CategoryCardProps {
  category: UniversalCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

function CategoryCard({ category, isExpanded, onToggle }: CategoryCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{category.icon}</span>
          <div className="text-left">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {category.name}
            </p>
            <p className="text-xs text-gray-500">
              {category.synonyms.length} 个同义词
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="size-4 text-gray-400" />
        ) : (
          <ChevronRight className="size-4 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {category.synonyms.map((syn) => (
              <Badge key={syn} variant="secondary" className="text-xs">
                {syn}
              </Badge>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            推荐文件夹：
            <span className="font-medium text-gray-700 dark:text-gray-300 ml-1">
              {category.suggestedFolderName}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 历史记录项
 */
interface HistoryItemProps {
  item: ClassificationHistoryItem;
}

function HistoryItem({ item }: HistoryItemProps) {
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

// ============================================
// 主组件
// ============================================

export function ClassificationManagerClient() {
  // 状态
  const [activeTab, setActiveTab] = useState("rules");
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroup, setSelectedGroup] = useState<CategoryGroup | "all">(
    "all",
  );

  // 统计数据
  const [stats, setStats] = useState<ClassificationStats>({
    totalBookmarks: 0,
    classifiedCount: 0,
    pendingCount: 0,
    acceptanceRate: 0,
    autoClassificationRate: 0,
  });

  // 历史记录
  const [history, setHistory] = useState<ClassificationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 权重配置
  const [weights, setWeights] = useState<WeightConfig>({
    vector: CLASSIFICATION_WEIGHTS.VECTOR * 100,
    history: CLASSIFICATION_WEIGHTS.HISTORY * 100,
    ai: CLASSIFICATION_WEIGHTS.AI * 100,
  });

  // 阈值配置
  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    high: CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE,
    medium: CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE,
  });

  // 开关配置
  const [features, setFeatures] = useState({
    tieredOptimization: true,
    knnDirect: true,
    universalCategories: true,
    tagMatcher: true,
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
        setStats({
          totalBookmarks: data.data.bookmarks?.total || 0,
          classifiedCount: data.data.bookmarks?.classified || 0,
          pendingCount: data.data.bookmarks?.unclassified || 0,
          acceptanceRate: data.data.learning?.acceptanceRate || 0,
          autoClassificationRate: data.data.bookmarks?.classificationRate || 0,
        });
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
      toast.error("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 加载历史记录
   */
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(
        "/api/classification/analytics?type=history&limit=20",
      );
      const data = await response.json();

      if (data.success && data.data?.items) {
        setHistory(data.data.items);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

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
      // 保存权重配置到后端
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

  /**
   * 切换分类展开状态
   */
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

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

  // 初始化加载
  useEffect(() => {
    loadStats();
    loadHistory();
  }, [loadStats, loadHistory]);

  // 过滤分类
  const filteredCategories =
    selectedGroup === "all"
      ? UNIVERSAL_CATEGORIES
      : UNIVERSAL_CATEGORIES.filter((c) => c.group === selectedGroup);

  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-8">
      {/* 页面标题 */}
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
          title="接受率"
          value={`${stats.acceptanceRate}%`}
          description="用户接受建议的比例"
          icon={TrendingUp}
          colorClass="text-blue-600"
        />
      </div>

      {/* 主内容区 */}
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

        {/* 分类规则 Tab */}
        <TabsContent value="rules" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 左侧：分类列表 */}
            <div className="lg:col-span-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="size-5 text-purple-500" />
                        通用分类体系
                      </CardTitle>
                      <CardDescription>
                        {UNIVERSAL_CATEGORIES.length} 个预设分类， 覆盖 90%+
                        的收藏内容场景
                      </CardDescription>
                    </div>
                    {/* 分组筛选 */}
                    <div className="flex gap-1 flex-wrap">
                      <Badge
                        variant={
                          selectedGroup === "all" ? "default" : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => setSelectedGroup("all")}
                      >
                        全部
                      </Badge>
                      {(
                        Object.keys(CATEGORY_GROUP_NAMES) as CategoryGroup[]
                      ).map((group) => (
                        <Badge
                          key={group}
                          variant={
                            selectedGroup === group ? "default" : "outline"
                          }
                          className="cursor-pointer"
                          onClick={() => setSelectedGroup(group)}
                        >
                          {CATEGORY_GROUP_NAMES[group]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-2">
                      {filteredCategories.map((category) => (
                        <CategoryCard
                          key={category.id}
                          category={category}
                          isExpanded={expandedCategories.has(category.id)}
                          onToggle={() => toggleCategory(category.id)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* 右侧：匹配器配置 */}
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings2 className="size-4" />
                    匹配策略开关
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tiered" className="flex flex-col gap-0.5">
                      <span>分层优化策略</span>
                      <span className="text-xs font-normal text-gray-500">
                        优先快速匹配，减少 AI 调用
                      </span>
                    </Label>
                    <Switch
                      id="tiered"
                      checked={features.tieredOptimization}
                      onCheckedChange={(c) =>
                        setFeatures((prev) => ({
                          ...prev,
                          tieredOptimization: c,
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label htmlFor="knn" className="flex flex-col gap-0.5">
                      <span>k-NN 直接匹配</span>
                      <span className="text-xs font-normal text-gray-500">
                        相似度 ≥
                        {MATCHER_STRATEGY_CONFIG.KNN_DIRECT
                          .SIMILARITY_THRESHOLD * 100}
                        % 直接归类
                      </span>
                    </Label>
                    <Switch
                      id="knn"
                      checked={features.knnDirect}
                      onCheckedChange={(c) =>
                        setFeatures((prev) => ({ ...prev, knnDirect: c }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="universal"
                      className="flex flex-col gap-0.5"
                    >
                      <span>通用分类匹配</span>
                      <span className="text-xs font-normal text-gray-500">
                        使用预设分类体系
                      </span>
                    </Label>
                    <Switch
                      id="universal"
                      checked={features.universalCategories}
                      onCheckedChange={(c) =>
                        setFeatures((prev) => ({
                          ...prev,
                          universalCategories: c,
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tag" className="flex flex-col gap-0.5">
                      <span>标签匹配器</span>
                      <span className="text-xs font-normal text-gray-500">
                        基于标签相似度匹配
                      </span>
                    </Label>
                    <Switch
                      id="tag"
                      checked={features.tagMatcher}
                      onCheckedChange={(c) =>
                        setFeatures((prev) => ({ ...prev, tagMatcher: c }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 阈值配置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="size-4" />
                    置信度阈值
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>高置信度阈值</Label>
                      <span className="text-sm font-medium text-green-600">
                        {thresholds.high}%
                      </span>
                    </div>
                    <Slider
                      value={[thresholds.high]}
                      onValueChange={(v) =>
                        setThresholds((prev) => ({ ...prev, high: v[0] }))
                      }
                      max={100}
                      min={60}
                      step={5}
                    />
                    <p className="text-xs text-gray-500">
                      超过此分数直接分类，跳过确认
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>中置信度阈值</Label>
                      <span className="text-sm font-medium text-blue-600">
                        {thresholds.medium}%
                      </span>
                    </div>
                    <Slider
                      value={[thresholds.medium]}
                      onValueChange={(v) =>
                        setThresholds((prev) => ({ ...prev, medium: v[0] }))
                      }
                      max={80}
                      min={40}
                      step={5}
                    />
                    <p className="text-xs text-gray-500">
                      超过此分数保存建议，否则进入待整理
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 分类历史 Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-purple-500" />
                分类建议历史
              </CardTitle>
              <CardDescription>最近 20 条分类建议记录</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="size-6 animate-spin text-gray-400" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="size-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">暂无分类历史记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <HistoryItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 权重配置 Tab */}
        <TabsContent value="weights" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 权重调整 */}
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>查询扩展匹配</span>
                      <span className="font-medium">
                        {MATCHER_STRATEGY_CONFIG.QUERY_EXPANSION.WEIGHT * 100}%
                      </span>
                    </div>
                    <Progress
                      value={
                        MATCHER_STRATEGY_CONFIG.QUERY_EXPANSION.WEIGHT * 100
                      }
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
