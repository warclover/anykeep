/**
 * 确认模式切换器组件
 *
 * 支持列表模式、卡片流模式切换
 *
 * @module components/batch-classification/confirmation-mode-switcher
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutGrid, LayoutList, Sparkles, ChevronDown } from "lucide-react";
import type { ConfirmationMode } from "@/lib/classification-v2/types/legacy-compat";

// ============================================
// Props
// ============================================

interface ConfirmationModeSwitcherProps {
  mode: ConfirmationMode;
  onModeChange: (mode: ConfirmationMode) => void;
  conflictCount?: number;
  totalCount?: number;
  suggestedMode?: ConfirmationMode;
}

// ============================================
// 常量
// ============================================

const MODE_INFO: Record<
  ConfirmationMode,
  { label: string; description: string; icon: React.ReactNode }
> = {
  list: {
    label: "列表模式",
    description: "查看所有分类建议，批量操作",
    icon: <LayoutList className="h-4 w-4" />,
  },
  cards: {
    label: "卡片流模式",
    description: "逐个审核，适合冲突较多的情况",
    icon: <LayoutGrid className="h-4 w-4" />,
  },
  suggest_cards: {
    label: "智能切换",
    description: "根据冲突数量自动选择最佳模式",
    icon: <Sparkles className="h-4 w-4" />,
  },
};

// ============================================
// 组件
// ============================================

export function ConfirmationModeSwitcher({
  mode,
  onModeChange,
  conflictCount = 0,
  totalCount = 0,
  suggestedMode,
}: ConfirmationModeSwitcherProps) {
  const currentMode = MODE_INFO[mode];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          {currentMode.icon}
          <span>{currentMode.label}</span>
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span>确认模式</span>
          {conflictCount > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              {conflictCount} 个冲突 / {totalCount} 个分类
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(v) => onModeChange(v as ConfirmationMode)}
        >
          <DropdownMenuRadioItem
            value="list"
            className="flex flex-col items-start py-3"
          >
            <div className="flex items-center gap-2">
              {MODE_INFO.list.icon}
              <span className="font-medium">{MODE_INFO.list.label}</span>
            </div>
            <span className="text-xs text-muted-foreground ml-6">
              {MODE_INFO.list.description}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="cards"
            className="flex flex-col items-start py-3"
          >
            <div className="flex items-center gap-2">
              {MODE_INFO.cards.icon}
              <span className="font-medium">{MODE_INFO.cards.label}</span>
              {suggestedMode === "cards" && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  推荐
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-6">
              {MODE_INFO.cards.description}
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {suggestedMode && suggestedMode !== mode && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-xs text-muted-foreground">
              💡 根据冲突数量，建议使用「{MODE_INFO[suggestedMode].label}」
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// 辅助函数
// ============================================

/**
 * 根据冲突数量确定建议的确认模式
 */
export function getSuggestedConfirmationMode(
  conflictCount: number,
  totalCount: number,
): ConfirmationMode {
  // 总数太多，保持列表
  if (totalCount > 50) return "list";

  // 冲突太多，强制卡片
  if (conflictCount > 20) return "cards";

  // 冲突较多，建议卡片
  if (conflictCount > 10) return "suggest_cards";

  // 默认列表
  return "list";
}
