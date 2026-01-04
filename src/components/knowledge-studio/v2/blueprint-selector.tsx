/**
 * Blueprint Selector v2 - 增强蓝图选择器
 * @module knowledge-studio/v2
 *
 * 功能:
 * - 展示 14 个蓝图卡片
 * - 分类 Tab（全部 / 极客 / 创作者 / 商业 / 专业）
 * - 权限标识（Pro 锁定徽章）
 * - 搜索/过滤
 * - 响应式网格布局
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Lock, Check, Sparkles, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { BlueprintTier } from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// Types
// ============================================================

/**
 * Blueprint list item (from API)
 */
export interface BlueprintListItem {
  blueprintId: string;
  displayName: string;
  description: string;
  icon: string;
  tier: BlueprintTier;
  category?:
    | "geek"
    | "creator"
    | "business"
    | "professional"
    | "tech"
    | "classic"
    | "custom";
  isNew?: boolean;
  tags?: string[];
  canAccess: boolean;
  upgradeMessage?: string;
  creditsCost: number;
  briefingEnabled: boolean;
  supportsOutline: boolean;
}

export interface BlueprintSelectorV2Props {
  /** 蓝图列表 */
  blueprints: BlueprintListItem[];
  /** 当前选中的蓝图 ID */
  value?: string;
  /** 选中蓝图时的回调 */
  onChange?: (blueprintId: string) => void;
  /** 用户会员等级 */
  userTier?: BlueprintTier;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 升级按钮点击回调 */
  onUpgradeClick?: () => void;
  /** 是否正在加载 */
  isLoading?: boolean;
}

/**
 * 分类配置
 */
const CATEGORY_CONFIG = {
  all: { label: "全部", order: 0 },
  geek: { label: "极客", order: 1 },
  creator: { label: "创作者", order: 2 },
  business: { label: "商业", order: 3 },
  professional: { label: "专业", order: 4 },
} as const;

type CategoryKey = keyof typeof CATEGORY_CONFIG;

/**
 * 层级标签
 */
const TIER_LABELS: Record<BlueprintTier, string> = {
  free: "免费",
  pro: "Pro",
  enterprise: "企业版",
};

// ============================================================
// Component
// ============================================================

export function BlueprintSelectorV2({
  blueprints,
  value,
  onChange,
  userTier: _userTier = "free",
  disabled = false,
  className,
  onUpgradeClick,
  isLoading = false,
}: BlueprintSelectorV2Props) {
  const [selected, setSelected] = useState<string | undefined>(value);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [lockedBlueprint, setLockedBlueprint] =
    useState<BlueprintListItem | null>(null);

  // 过滤蓝图
  const filteredBlueprints = useMemo(() => {
    let result = blueprints;

    // 按分类过滤
    if (activeCategory !== "all") {
      result = result.filter((bp) => bp.category === activeCategory);
    }

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (bp) =>
          bp.displayName.toLowerCase().includes(query) ||
          bp.description.toLowerCase().includes(query) ||
          bp.tags?.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return result;
  }, [blueprints, activeCategory, searchQuery]);

  // 各分类数量
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      all: blueprints.length,
      geek: 0,
      creator: 0,
      business: 0,
      professional: 0,
    };

    blueprints.forEach((bp) => {
      const cat = bp.category as CategoryKey;
      if (cat && counts[cat] !== undefined) {
        counts[cat]++;
      }
    });

    return counts;
  }, [blueprints]);

  /**
   * 处理蓝图选择
   */
  const handleSelect = useCallback(
    (blueprint: BlueprintListItem) => {
      if (disabled) return;

      if (!blueprint.canAccess) {
        // 显示升级对话框
        setLockedBlueprint(blueprint);
        setUpgradeDialogOpen(true);
        return;
      }

      setSelected(blueprint.blueprintId);
      onChange?.(blueprint.blueprintId);
    },
    [disabled, onChange],
  );

  /**
   * 处理升级按钮点击
   */
  const handleUpgradeClick = useCallback(() => {
    setUpgradeDialogOpen(false);
    onUpgradeClick?.();
  }, [onUpgradeClick]);

  /**
   * 清除搜索
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex gap-4">
          <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
          <div className="h-10 flex-1 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 搜索和分类 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* 分类 Tabs */}
        <Tabs
          value={activeCategory}
          onValueChange={(v) => setActiveCategory(v as CategoryKey)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-5 sm:w-auto sm:inline-flex">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                {config.label}
                {categoryCounts[key as CategoryKey] > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 px-1.5 py-0 text-[10px]"
                  >
                    {categoryCounts[key as CategoryKey]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* 搜索框 */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索蓝图..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 蓝图卡片网格 */}
      {filteredBlueprints.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? (
            <>
              <p>没有找到匹配 &quot;{searchQuery}&quot; 的蓝图</p>
              <Button
                variant="link"
                onClick={handleClearSearch}
                className="mt-2"
              >
                清除搜索
              </Button>
            </>
          ) : (
            <p>该分类下暂无蓝图</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBlueprints.map((blueprint) => {
            const isSelected = selected === blueprint.blueprintId;
            const isLocked = !blueprint.canAccess;

            return (
              <Card
                key={blueprint.blueprintId}
                className={cn(
                  "group relative cursor-pointer transition-all hover:shadow-md",
                  isSelected &&
                    blueprint.canAccess &&
                    "ring-2 ring-primary ring-offset-2",
                  isLocked && "opacity-70 hover:opacity-100",
                  disabled && "cursor-not-allowed opacity-50",
                )}
                onClick={() => handleSelect(blueprint)}
              >
                <CardContent className="p-4">
                  {/* 顶部标记区域 */}
                  <div className="absolute right-3 top-3 flex items-center gap-1">
                    {/* NEW 标签 */}
                    {blueprint.isNew && (
                      <Badge
                        variant="secondary"
                        className="bg-green-500/10 text-green-600 text-[10px] px-1.5 py-0"
                      >
                        NEW
                      </Badge>
                    )}

                    {/* Pro/Enterprise 标签 */}
                    {blueprint.tier !== "free" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          blueprint.tier === "pro" &&
                            "border-amber-500 text-amber-600",
                          blueprint.tier === "enterprise" &&
                            "border-purple-500 text-purple-600",
                        )}
                      >
                        {TIER_LABELS[blueprint.tier]}
                      </Badge>
                    )}

                    {/* 锁定图标 */}
                    {isLocked && (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}

                    {/* 选中指示器 */}
                    {isSelected && blueprint.canAccess && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>

                  {/* 图标 */}
                  <div className="mb-3 text-3xl">{blueprint.icon}</div>

                  {/* 名称 */}
                  <h3 className="font-semibold text-base">
                    {blueprint.displayName}
                  </h3>

                  {/* 描述 */}
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                    {blueprint.description}
                  </p>

                  {/* 底部信息 */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{blueprint.creditsCost} 配额</span>
                    {blueprint.briefingEnabled && (
                      <span className="flex items-center gap-0.5">
                        <Sparkles className="h-3 w-3" />
                        Briefing
                      </span>
                    )}
                    {blueprint.supportsOutline && (
                      <span className="text-blue-500">大纲模式</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 升级提示对话框 */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              需要升级会员
            </DialogTitle>
            <DialogDescription className="pt-2">
              {lockedBlueprint && (
                <>
                  <span className="font-medium">
                    {lockedBlueprint.icon} {lockedBlueprint.displayName}
                  </span>{" "}
                  是{" "}
                  <span className="font-medium text-primary">
                    {TIER_LABELS[lockedBlueprint.tier]}
                  </span>{" "}
                  专属蓝图。
                  <br />
                  <br />
                  {lockedBlueprint.description}
                  <br />
                  <br />
                  {lockedBlueprint.upgradeMessage ||
                    "升级后可解锁该蓝图及更多高级功能。"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setUpgradeDialogOpen(false)}
            >
              稍后再说
            </Button>
            <Button onClick={handleUpgradeClick}>立即升级</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BlueprintSelectorV2;
