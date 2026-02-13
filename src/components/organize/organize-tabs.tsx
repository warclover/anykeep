/**
 * 整理中心 Tab 切换组件
 *
 * 展示 6 个 Tab：待处理、未读、高价值、已失效、最近、健康诊断
 * 支持计数徽章显示
 *
 * @version 1.0.0
 * @since 2026-02-13
 */

"use client";

import {
  ORGANIZE_TABS,
  type OrganizeTabId,
} from "@/lib/constants/organize-tabs";
import { useOrganizeCounts } from "@/hooks/data/use-organize-counts";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// ==================== 类型定义 ====================

interface OrganizeTabsProps {
  activeTab: OrganizeTabId;
  onTabChange: (tab: OrganizeTabId) => void;
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
  className,
}: OrganizeTabsProps) {
  const { counts, isLoading } = useOrganizeCounts();

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
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as OrganizeTabId)}
      className={cn("w-full", className)}
    >
      <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
        {ORGANIZE_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = getTabCount(tab.id);
          const isActive = activeTab === tab.id;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted",
                tab.id === "health" &&
                  "data-[state=active]:bg-purple-500 data-[state=active]:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {count !== null && count > 0 && (
                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className={cn(
                    "ml-1 h-5 min-w-5 px-1.5 text-xs",
                    isActive && "bg-white/20 text-white border-white/30",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
