/**
 * 整理中心 Tab 切换组件
 *
 * 展示 6 个 Tab：待处理、未读、高价值、已失效、最近、健康诊断
 * 支持计数徽章显示
 *
 * @version 1.1.0 - 更紧凑的样式
 * @since 2026-02-13
 * @updated 2026-02-14
 */

"use client";

import {
  ORGANIZE_TABS,
  type OrganizeTabId,
} from "@/lib/constants/organize-tabs";
import type { OrganizeCounts } from "@/hooks/data/use-organize-counts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ==================== 类型定义 ====================

interface OrganizeTabsProps {
  activeTab: OrganizeTabId;
  onTabChange: (tab: OrganizeTabId) => void;
  /** 各 Tab 计数（由父组件传入，避免重复订阅） */
  counts: OrganizeCounts;
  isCountsLoading?: boolean;
  className?: string;
}

// ==================== 组件 ====================

/**
 * 整理中心 Tab 切换器
 *
 * 功能：
 * - 6 个 Tab 切换
 * - 显示各 Tab 的计数徽章
 * - 响应式布局
 */
export function OrganizeTabs({
  activeTab,
  onTabChange,
  counts,
  isCountsLoading: isLoading = false,
  className,
}: OrganizeTabsProps) {
  /**
   * 获取 Tab 计数
   */
  const getTabCount = (tabId: OrganizeTabId): number | null => {
    // 健康诊断 Tab 不显示计数
    if (tabId === "health") return null;

    if (isLoading) return null;

    const count = counts[tabId as keyof typeof counts];
    return count ?? 0;
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {ORGANIZE_TABS.map((tab) => {
        const count = getTabCount(tab.id);
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              isActive
                ? tab.id === "health"
                  ? "bg-purple-500 text-white"
                  : "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <span>{tab.label}</span>
            {count !== null && count > 0 && (
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className={cn(
                  "h-4 min-w-4 px-1 text-[10px]",
                  isActive && "bg-white/20 text-white border-white/30",
                )}
              >
                {count > 99 ? "99+" : count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
