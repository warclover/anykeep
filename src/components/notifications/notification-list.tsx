/**
 * 通知列表
 * @description 支持无限滚动的通知列表组件
 */

"use client";

import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCard } from "./notification-card";
import { NotificationGroupHeader } from "./notification-group-header";
import { NotificationEmpty } from "./notification-empty";
import { NotificationListSkeleton } from "./notification-skeleton";
import type { NotificationGroup } from "@/lib/notifications";

interface NotificationListProps {
  /** 分组后的通知列表 */
  groups: NotificationGroup[];
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否正在加载下一页 */
  isFetchingNextPage?: boolean;
  /** 是否有下一页 */
  hasNextPage?: boolean;
  /** 加载下一页回调 */
  onLoadMore?: () => void;
  /** 标记已读回调 */
  onMarkAsRead?: (id: string) => void;
  /** 删除回调 */
  onDelete?: (id: string) => void;
  /** 归档回调 */
  onArchive?: (id: string) => void;
  /** 筛选状态（用于空状态提示） */
  filterStatus?: string;
  /** 筛选优先级（用于空状态提示） */
  filterPriority?: string;
  /** 自定义类名 */
  className?: string;
}

export function NotificationList({
  groups,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onLoadMore,
  onMarkAsRead,
  onDelete,
  onArchive,
  filterStatus,
  filterPriority,
  className,
}: NotificationListProps) {
  // 无限滚动触发器
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px", // 提前 200px 触发加载
  });

  // 当触发器进入视口时加载更多
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [inView, hasNextPage, isFetchingNextPage, onLoadMore]);

  // 初始加载状态
  if (isLoading && groups.length === 0) {
    return <NotificationListSkeleton count={5} />;
  }

  // 空状态
  if (groups.length === 0) {
    const hasFilter = filterStatus || filterPriority;
    return (
      <NotificationEmpty
        variant={hasFilter ? "filtered" : "default"}
        filterStatus={filterStatus}
        filterPriority={filterPriority}
      />
    );
  }

  return (
    <div className={cn("divide-y divide-border/50", className)}>
      {groups.map((group) => (
        <div key={group.dateGroup}>
          {/* 分组标题 */}
          <NotificationGroupHeader
            dateGroup={group.dateGroup}
            label={group.label}
            count={group.notifications.length}
          />

          {/* 通知卡片列表 */}
          <div className="divide-y divide-border/30">
            {group.notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onDelete={onDelete}
                onArchive={onArchive}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 加载更多触发器 */}
      {hasNextPage && (
        <div
          ref={loadMoreRef}
          className="flex items-center justify-center py-4"
        >
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              向下滚动加载更多
            </span>
          )}
        </div>
      )}

      {/* 已加载全部 */}
      {!hasNextPage && groups.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <span className="text-xs text-muted-foreground">已加载��部通知</span>
        </div>
      )}
    </div>
  );
}
