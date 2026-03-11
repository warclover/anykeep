/**
 * 分类规则 Tab 组件
 *
 * 包含：
 * - 智能分类（90+ 通用分类体系）
 * - 自定义规则（关键词 | 来源 | 正则）
 * - 文件夹映射（分类 → 文件夹绑定）
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UNIVERSAL_CATEGORIES,
  CATEGORY_GROUP_NAMES,
  MATCHER_STRATEGY_CONFIG,
  type CategoryGroup,
  type UniversalCategory,
} from "@/lib/classification-v2";

// ============================================
// 类型定义
// ============================================

interface ThresholdConfig {
  high: number;
  medium: number;
}

// ============================================
// 子组件
// ============================================

/**
 * 分类卡片
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

// ============================================
// 主组件
// ============================================

export function ClassificationRulesTab() {
  // 状态
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroup, setSelectedGroup] = useState<CategoryGroup | "all">(
    "all",
  );

  // 阈值配置
  const [thresholds, setThresholds] = useState<ThresholdConfig>({
    high: 80,
    medium: 60,
  });

  // 开关配置
  const [features, setFeatures] = useState({
    tieredOptimization: true,
    knnDirect: true,
    universalCategories: true,
    tagMatcher: true,
  });

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

  // 过滤分类
  const filteredCategories =
    selectedGroup === "all"
      ? UNIVERSAL_CATEGORIES
      : UNIVERSAL_CATEGORIES.filter((c) => c.group === selectedGroup);

  return (
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
                  {UNIVERSAL_CATEGORIES.length} 个预设分类，覆盖 90%+
                  的收藏内容场景
                </CardDescription>
              </div>
              {/* ��组筛选 */}
              <div className="flex gap-1 flex-wrap">
                <Badge
                  variant={selectedGroup === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedGroup("all")}
                >
                  全部
                </Badge>
                {(Object.keys(CATEGORY_GROUP_NAMES) as CategoryGroup[]).map(
                  (group) => (
                    <Badge
                      key={group}
                      variant={selectedGroup === group ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSelectedGroup(group)}
                    >
                      {CATEGORY_GROUP_NAMES[group]}
                    </Badge>
                  ),
                )}
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
                  {MATCHER_STRATEGY_CONFIG.KNN_DIRECT.SIMILARITY_THRESHOLD *
                    100}
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
              <Label htmlFor="universal" className="flex flex-col gap-0.5">
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
  );
}
