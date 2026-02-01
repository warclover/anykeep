/**
 * 通知页面
 * @description 通知中心主页面组件
 */

"use client";

import { useState, useCallback } from "react";
import { RefreshCw, CheckCheck, Filter, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationList } from "./notification-list";
import { NotificationBadge } from "./notification-badge";
import {
  useNotifications,
  useNotificationCounts,
} from "@/hooks/data/use-notifications";
import type {
  NotificationStatus,
  NotificationPriority,
} from "@/lib/notifications";

// ============================================================================
// 筛选选项
// ============================================================================

const STATUS_OPTIONS: { value: NotificationStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "unread", label: "未读" },
  { value: "read", label: "已读" },
  { value: "archived", label: "已归档" },
];

const PRIORITY_OPTIONS: {
  value: NotificationPriority | "all";
  label: string;
}[] = [
  { value: "all", label: "全部优先级" },
  { value: "critical", label: "紧急" },
  { value: "important", label: "重要" },
  { value: "normal", label: "普通" },
  { value: "silent", label: "静默" },
];

// ============================================================================
// 组件
// ============================================================================

interface NotificationPageProps {
  className?: string;
}

export function NotificationPage({ className }: NotificationPageProps) {
  // 筛选状态
  const [status, setStatus] = useState<NotificationStatus | "all">("all");
  const [priority, setPriority] = useState<NotificationPriority | "all">("all");

  // 数据查询
  const {
    groups,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    archiveNotification,
  } = useNotifications({
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : [priority],
  });

  // 未读计数
  const { counts } = useNotificationCounts();

  // 是否有活跃筛选
  const hasActiveFilter = status !== "all" || priority !== "all";

  // 刷新中状态
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 刷新处理
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    refresh();
    // 模拟刷新延迟
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refresh]);

  // 重置筛选
  const handleResetFilter = useCallback(() => {
    setStatus("all");
    setPriority("all");
  }, []);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          {/* 标题 */}
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">通知</h1>
            {counts.total > 0 && (
              <NotificationBadge
                count={counts.total}
                hasImportant={counts.critical > 0 || counts.important > 0}
                size="sm"
              />
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {/* 刷新 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("size-4", isRefreshing && "animate-spin")}
              />
              <span className="sr-only">刷新</span>
            </Button>

            {/* 全部已读 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              disabled={counts.total === 0}
              className="hidden sm:flex"
            >
              <CheckCheck className="size-4 mr-1" />
              全部已读
            </Button>

            {/* 移动端全部已读 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => markAllAsRead()}
              disabled={counts.total === 0}
              className="sm:hidden"
            >
              <CheckCheck className="size-4" />
              <span className="sr-only">全部已读</span>
            </Button>

            {/* 筛选器 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Filter className="size-4" />
                  {hasActiveFilter && (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
                  )}
                  <span className="sr-only">筛选</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {/* 状态筛选 */}
                <DropdownMenuRadioGroup
                  value={status}
                  onValueChange={(v) =>
                    setStatus(v as NotificationStatus | "all")
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                {/* 优先级筛选 */}
                <DropdownMenuRadioGroup
                  value={priority}
                  onValueChange={(v) =>
                    setPriority(v as NotificationPriority | "all")
                  }
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                {/* 重置筛选 */}
                {hasActiveFilter && (
                  <>
                    <DropdownMenuSeparator />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleResetFilter}
                    >
                      重置筛选
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 活跃筛选提示 */}
        {hasActiveFilter && (
          <div className="px-4 py-2 bg-muted/50 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>筛选:</span>
              {status !== "all" && (
                <span className="px-2 py-0.5 bg-background rounded text-xs">
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label}
                </span>
              )}
              {priority !== "all" && (
                <span className="px-2 py-0.5 bg-background rounded text-xs">
                  {PRIORITY_OPTIONS.find((o) => o.value === priority)?.label}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                onClick={handleResetFilter}
              >
                清除
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 通知列表 */}
      <div className="flex-1 overflow-y-auto">
        <NotificationList
          groups={groups}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          onLoadMore={fetchNextPage}
          onMarkAsRead={markAsRead}
          onDelete={deleteNotification}
          onArchive={archiveNotification}
          filterStatus={status !== "all" ? status : undefined}
          filterPriority={priority !== "all" ? priority : undefined}
        />
      </div>
    </div>
  );
}
