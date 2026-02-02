/**
 * 消息列表组件
 * @description 按日期分组展示消息列表
 */

"use client";

import { useCallback } from "react";
import { MessageItem } from "./message-item";
import { MessageGroupHeader } from "./message-group-header";
import { MessageEmptyState } from "./message-empty-state";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { MessageGroup } from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

export interface MessageListProps {
  /** 消息分组列表 */
  groups: MessageGroup[];
  /** 是否加载中 */
  isLoading?: boolean;
  /** 是否有更多数据 */
  hasMore?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
  /** 标记已读回调 */
  onRead?: (id: string) => Promise<boolean>;
  /** 删除消息回调 */
  onDelete?: (id: string) => Promise<boolean>;
  /** 归档消息回调 */
  onArchive?: (id: string) => Promise<boolean>;
}

// ============================================
// 组件实现
// ============================================

export function MessageList({
  groups,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onRead,
  onDelete,
  onArchive,
}: MessageListProps) {
  // 处理标记已读
  const handleRead = useCallback(
    (id: string) => {
      onRead?.(id);
    },
    [onRead],
  );

  // 处理删除
  const handleDelete = useCallback(
    (id: string) => {
      onDelete?.(id);
    },
    [onDelete],
  );

  // 处理归档
  const handleArchive = useCallback(
    (id: string) => {
      onArchive?.(id);
    },
    [onArchive],
  );

  // 空状态
  if (!isLoading && groups.length === 0) {
    return <MessageEmptyState />;
  }

  return (
    <div className="divide-y divide-border">
      {groups.map((group) => (
        <div key={group.date_group}>
          {/* 日期分组标题 */}
          <MessageGroupHeader
            dateGroup={group.date_group}
            label={group.label}
          />

          {/* 该分组下的消息 */}
          <div className="divide-y divide-border/50">
            {group.messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onRead={handleRead}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 加载更多 */}
      {(hasMore || isLoading) && (
        <div className="flex justify-center py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          ) : (
            <Button variant="ghost" onClick={onLoadMore}>
              加载更多
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
