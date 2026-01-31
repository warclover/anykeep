/**
 * 收件箱 Tab 切换组件
 *
 * 显示各筛选标签及其计数，支持：
 * - Tab 切换
 * - 实时计数显示
 * - 加载状态
 */

"use client";

import { cn } from "@/lib/utils";
import { INBOX_TABS, type InboxTabId } from "@/lib/constants/inbox-tabs";
import { useInboxCounts } from "@/hooks/data/use-inbox-counts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ==================== 类型定义 ====================

interface InboxTabsProps {
  activeTab: InboxTabId;
  onTabChange: (tab: InboxTabId) => void;
  className?: string;
}

// ==================== 组件 ====================

export function InboxTabs({
  activeTab,
  onTabChange,
  className,
}: InboxTabsProps) {
  const { counts, isLoading } = useInboxCounts();

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg",
          className,
        )}
      >
        {INBOX_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          const isActive = activeTab === tab.id;

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {isLoading ? (
                    <Skeleton className="h-4 w-6 rounded-full" />
                  ) : (
                    count > 0 && (
                      <span
                        className={cn(
                          "ml-0.5 px-1.5 py-0.5 text-xs rounded-full tabular-nums",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-foreground/20 text-muted-foreground",
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="sm:hidden">
                <p>{tab.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ==================== 骨架屏 ====================

export function InboxTabsSkeleton() {
  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-md" />
      ))}
    </div>
  );
}
