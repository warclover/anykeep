/**
 * 消息页面
 * @description 消息中心，展示用户的所有消息通知
 */

"use client";

import { useState, useCallback } from "react";
import { CheckCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageList, MessageFilter } from "@/components/messages";
import { useMessages } from "@/hooks/data";
import { toast } from "sonner";
import type { MessageStatus, MessageLevel } from "@/lib/messages";

export default function MessagesPage() {
  // 筛选状态
  const [status, setStatus] = useState<MessageStatus | "all">("all");
  const [level, setLevel] = useState<MessageLevel | undefined>(undefined);

  // 获取消息数据
  const {
    groups,
    isLoading,
    pagination,
    refresh,
    loadMore,
    markAsRead,
    deleteMessage,
    markAllAsRead,
    archiveMessage,
  } = useMessages({
    status,
    level,
    limit: 20,
  });

  // 处理全部已读
  const handleMarkAllRead = useCallback(async () => {
    const success = await markAllAsRead();
    if (success) {
      toast.success("已标记所有消息为已读");
    } else {
      toast.error("操作失败，请重试");
    }
  }, [markAllAsRead]);

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    await refresh();
    toast.success("已刷新");
  }, [refresh]);

  // 处理标记已读
  const handleRead = useCallback(
    async (id: string) => {
      const success = await markAsRead(Number(id));
      if (!success) {
        toast.error("操作失败");
      }
      return success;
    },
    [markAsRead],
  );

  // 处理删除
  const handleDelete = useCallback(
    async (id: string) => {
      const success = await deleteMessage(Number(id));
      if (success) {
        toast.success("消息已删除");
      } else {
        toast.error("删除失败");
      }
      return success;
    },
    [deleteMessage],
  );

  // 处理归档
  const handleArchive = useCallback(
    async (id: string) => {
      const success = await archiveMessage(Number(id));
      if (success) {
        toast.success("消息已归档");
      } else {
        toast.error("归档失败");
      }
      return success;
    },
    [archiveMessage],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 页面头部 */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <h1 className="text-xl font-semibold">消息</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            title="刷新"
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="gap-2"
          >
            <CheckCheck className="size-4" />
            <span className="hidden sm:inline">全部已读</span>
          </Button>
          <MessageFilter
            status={status}
            level={level}
            onStatusChange={setStatus}
            onLevelChange={setLevel}
          />
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto">
        <MessageList
          groups={groups}
          isLoading={isLoading}
          hasMore={pagination.hasMore}
          onLoadMore={loadMore}
          onRead={handleRead}
          onDelete={handleDelete}
          onArchive={handleArchive}
        />
      </div>
    </div>
  );
}
