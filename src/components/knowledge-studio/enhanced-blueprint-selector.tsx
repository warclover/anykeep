"use client";

/**
 * Enhanced Blueprint Selector - 增强蓝图选择器 (Story 1.10)
 * @module components/knowledge-studio
 *
 * 验收标准:
 * - AC1: 按分类（极客/创作者/商业/技术/经典）分组展示
 * - AC2: P0 蓝图（isGeek）显示🔥标记
 * - AC3: 新蓝图显示 NEW 标签
 * - AC4: Pro/Enterprise 专属蓝图显示锁定图标
 * - AC5: 点击锁定蓝图显示升级提示
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Lock, Check, Sparkles } from "lucide-react";
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
import type {
  BlueprintTier,
  EnhancedBlueprintMetadata,
} from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// Types
// ============================================================

export interface EnhancedBlueprintSelectorProps {
  /** 蓝图元数据列表 */
  blueprints: EnhancedBlueprintMetadata[];
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
}

/**
 * 分类标签映射
 */
const CATEGORY_LABELS: Record<string, { label: string; order: number }> = {
  geek: { label: "极客专区", order: 1 },
  creator: { label: "创作者", order: 2 },
  business: { label: "商业文档", order: 3 },
  tech: { label: "技术写作", order: 4 },
  classic: { label: "经典模式", order: 5 },
  custom: { label: "自定义", order: 6 },
};

/**
 * 层级标签
 */
const TIER_LABELS: Record<BlueprintTier, string> = {
  free: "免费",
  pro: "Pro",
  enterprise: "企业版",
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * 按分类分组蓝图
 */
function groupByCategory(
  blueprints: EnhancedBlueprintMetadata[],
): Map<string, EnhancedBlueprintMetadata[]> {
  const groups = new Map<string, EnhancedBlueprintMetadata[]>();

  blueprints.forEach((bp) => {
    const category = bp.category ?? "custom";
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(bp);
  });

  // 按分类顺序排序
  const sortedGroups = new Map<string, EnhancedBlueprintMetadata[]>();
  const sortedCategories = Array.from(groups.keys()).sort((a, b) => {
    const orderA = CATEGORY_LABELS[a]?.order ?? 99;
    const orderB = CATEGORY_LABELS[b]?.order ?? 99;
    return orderA - orderB;
  });

  sortedCategories.forEach((cat) => {
    sortedGroups.set(cat, groups.get(cat)!);
  });

  return sortedGroups;
}

/**
 * 检查用户是否可以访问蓝图
 */
function canAccessBlueprint(
  blueprintTier: BlueprintTier,
  userTier: BlueprintTier,
): boolean {
  const tierOrder: Record<BlueprintTier, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
  };

  return tierOrder[userTier] >= tierOrder[blueprintTier];
}

// ============================================================
// Component
// ============================================================

export function EnhancedBlueprintSelector({
  blueprints,
  value,
  onChange,
  userTier = "free",
  disabled = false,
  className,
  onUpgradeClick,
}: EnhancedBlueprintSelectorProps) {
  const [selected, setSelected] = useState<string | undefined>(value);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [lockedBlueprint, setLockedBlueprint] =
    useState<EnhancedBlueprintMetadata | null>(null);

  // 按分类分组
  const groupedBlueprints = useMemo(
    () => groupByCategory(blueprints),
    [blueprints],
  );

  /**
   * 处理蓝图选择
   */
  const handleSelect = (blueprint: EnhancedBlueprintMetadata) => {
    if (disabled) return;

    const canAccess = canAccessBlueprint(blueprint.tier, userTier);

    if (!canAccess) {
      // 显示升级对话框
      setLockedBlueprint(blueprint);
      setUpgradeDialogOpen(true);
      return;
    }

    setSelected(blueprint.blueprintId);
    onChange?.(blueprint.blueprintId);
  };

  /**
   * 处理升级按钮点击
   */
  const handleUpgradeClick = () => {
    setUpgradeDialogOpen(false);
    onUpgradeClick?.();
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* 分组展示 */}
      {Array.from(groupedBlueprints.entries()).map(([category, bps]) => (
        <div key={category} className="space-y-3">
          {/* 分类标题 */}
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {CATEGORY_LABELS[category]?.label ?? category}
          </h3>

          {/* 蓝图卡片网格 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bps.map((blueprint) => {
              const isSelected = selected === blueprint.blueprintId;
              const canAccess = canAccessBlueprint(blueprint.tier, userTier);
              const isLocked = !canAccess;

              return (
                <button
                  key={blueprint.blueprintId}
                  type="button"
                  onClick={() => handleSelect(blueprint)}
                  disabled={disabled}
                  className={cn(
                    "group relative flex flex-col items-start rounded-lg border p-4 text-left transition-all",
                    "hover:border-primary hover:bg-accent/50",
                    isSelected &&
                      canAccess &&
                      "border-primary bg-accent ring-2 ring-primary ring-offset-2",
                    isLocked && "opacity-70 hover:opacity-100",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  {/* 顶部标记区域 */}
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {/* NEW 标签 (AC3) */}
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

                    {/* 锁定图标 (AC4) */}
                    {isLocked && (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}

                    {/* 选中指示器 */}
                    {isSelected && canAccess && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>

                  {/* 图标 + 🔥标记 (AC2) */}
                  <div className="mb-2 flex items-center gap-1">
                    <span className="text-2xl">{blueprint.icon}</span>
                    {blueprint.isGeek && (
                      <span className="text-lg" title="P0 热门蓝图">
                        🔥
                      </span>
                    )}
                  </div>

                  {/* 名称 */}
                  <span className="font-medium">{blueprint.displayName}</span>

                  {/* 描述 */}
                  <span className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {blueprint.description}
                  </span>

                  {/* 底部信息 */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>约 {blueprint.estimatedTimeSeconds}秒</span>
                    {blueprint.briefingEnabled && (
                      <span className="flex items-center gap-0.5">
                        <Sparkles className="h-3 w-3" />
                        Briefing
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 升级提示对话框 (AC5) */}
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
                  升级后可解锁该蓝图及更多高级功能。
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
