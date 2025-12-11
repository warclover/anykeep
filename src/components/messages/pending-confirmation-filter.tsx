/**
 * Pending Confirmation Filter
 * V4.2 待确认消息筛选组件
 *
 * @description 在消息页面提供待确认消息的快速筛选
 * - 显示待确认数量徽章
 * - 切换显示待确认/全部消息
 * - 按确认类型筛选
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Bell,
  Clock,
  FolderOpen,
  FolderPlus,
  GitMerge,
  Scissors,
  Pencil,
  ChevronDown,
} from "lucide-react";
import type { ConfirmationType } from "@/types/confirmation";

// ============================================================================
// 类型定义
// ============================================================================

export type FilterMode = "all" | "pending" | ConfirmationType;

export interface PendingConfirmationFilterProps {
  /** 当前筛选模式 */
  mode: FilterMode;
  /** 筛选模式变更回调 */
  onModeChange: (mode: FilterMode) => void;
  /** 待确认数量 */
  pendingCount?: number;
  /** 各类型待确认数量 */
  typeCounts?: Partial<Record<ConfirmationType, number>>;
  /** 是否加载中 */
  isLoading?: boolean;
}

// ============================================================================
// 常量配置
// ============================================================================

const FILTER_OPTIONS: Array<{
  value: FilterMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}> = [
  {
    value: "all",
    label: "全部消息",
    icon: Bell,
    description: "显示所有消息",
  },
  {
    value: "pending",
    label: "待确认",
    icon: Clock,
    description: "显示所有待确认消息",
  },
  {
    value: "classification",
    label: "分类确认",
    icon: FolderOpen,
    description: "分类建议确认",
  },
  {
    value: "folder_create",
    label: "创建文件夹",
    icon: FolderPlus,
    description: "新文件夹建议",
  },
  {
    value: "folder_merge",
    label: "合并文件夹",
    icon: GitMerge,
    description: "文件夹合并建议",
  },
  {
    value: "folder_split",
    label: "拆分文件夹",
    icon: Scissors,
    description: "文件夹拆分建议",
  },
  {
    value: "folder_rename",
    label: "重命名",
    icon: Pencil,
    description: "文件夹重命名建议",
  },
];

// ============================================================================
// 组件实现
// ============================================================================

export function PendingConfirmationFilter({
  mode,
  onModeChange,
  pendingCount = 0,
  typeCounts = {},
  isLoading = false,
}: PendingConfirmationFilterProps) {
  // 获取当前选中项
  const currentOption =
    FILTER_OPTIONS.find((opt) => opt.value === mode) || FILTER_OPTIONS[0];
  const CurrentIcon = currentOption.icon;

  // 获取类型计数
  const getTypeCount = (type: FilterMode): number => {
    if (type === "all") return 0;
    if (type === "pending") return pendingCount;
    return typeCounts[type as ConfirmationType] || 0;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isLoading}
        >
          <CurrentIcon className="size-4" />
          <span className="hidden sm:inline">{currentOption.label}</span>
          {mode === "pending" && pendingCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 px-1.5 py-0 text-xs bg-primary/10 text-primary"
            >
              {pendingCount > 99 ? "99+" : pendingCount}
            </Badge>
          )}
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* 全部消息 */}
        <DropdownMenuItem
          onClick={() => onModeChange("all")}
          className={cn(mode === "all" && "bg-accent")}
        >
          <Bell className="size-4 mr-2" />
          <span className="flex-1">全部消息</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 待确认（汇总） */}
        <DropdownMenuItem
          onClick={() => onModeChange("pending")}
          className={cn(mode === "pending" && "bg-accent")}
        >
          <Clock className="size-4 mr-2" />
          <span className="flex-1">待确认</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {pendingCount}
            </Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 各类型筛选 */}
        {FILTER_OPTIONS.filter(
          (opt) => !["all", "pending"].includes(opt.value)
        ).map((option) => {
          const Icon = option.icon;
          const count = getTypeCount(option.value);

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onModeChange(option.value)}
              className={cn(mode === option.value && "bg-accent")}
            >
              <Icon className="size-4 mr-2" />
              <span className="flex-1">{option.label}</span>
              {count > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {count}
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// 快速切换标签组件
// ============================================================================

export interface ConfirmationTabsProps {
  /** 当前选中标签 */
  activeTab: "messages" | "confirmations";
  /** 标签切换回调 */
  onTabChange: (tab: "messages" | "confirmations") => void;
  /** 待确认数量 */
  pendingCount?: number;
}

export function ConfirmationTabs({
  activeTab,
  onTabChange,
  pendingCount = 0,
}: ConfirmationTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => onTabChange("messages")}
        className={cn(
          "px-3 py-1.5 text-sm rounded-md transition-colors",
          activeTab === "messages"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        消息
      </button>
      <button
        onClick={() => onTabChange("confirmations")}
        className={cn(
          "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
          activeTab === "confirmations"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        待确认
        {pendingCount > 0 && (
          <Badge
            variant={activeTab === "confirmations" ? "default" : "secondary"}
            className="px-1.5 py-0 text-xs"
          >
            {pendingCount > 99 ? "99+" : pendingCount}
          </Badge>
        )}
      </button>
    </div>
  );
}

export default PendingConfirmationFilter;
