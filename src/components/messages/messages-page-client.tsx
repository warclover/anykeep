/**
 * 消息页面客户端组件
 * @description 用于 Keep-Alive 导航系统的消息页面入口
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, RefreshCw, Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageList } from "./message-list";
import { MessageFilter } from "./message-filter";
import { useMessages } from "@/hooks/use-messages";
import { toast } from "sonner";
import type { MessageStatus, MessageLevel } from "@/lib/messages";

// ============================================
// 组件实现
// ============================================

export function MessagesPageClient() {
  const router = useRouter();

  // 筛选状态
  const [status, setStatus] = useState<MessageStatus | "all">("all");
  const [level, setLevel] = useState<MessageLevel | undefined>(undefined);

  // V4.2: 待确认消息数量
  const [pendingCount, setPendingCount] = useState(0);

  // 获取待确认数量
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await fetch("/api/confirmations?status=pending&limit=1");
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.pendingCount || 0);
        }
      } catch {
        // 静默处理错误
      }
    };
    fetchPendingCount();
  }, []);

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
    async (id: number) => {
      const success = await markAsRead(id);
      if (!success) {
        toast.error("操作失败");
      }
      return success;
    },
    [markAsRead],
  );

  // 处理删除
  const handleDelete = useCallback(
    async (id: number) => {
      const success = await deleteMessage(id);
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
    async (id: number) => {
      const success = await archiveMessage(id);
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

      {/* V4.2: 待确认消息入口 */}
      {pendingCount > 0 && (
        <div className="px-4 sm:px-6 py-3 border-b">
          <button
            onClick={() => router.push("/messages/pending")}
            className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <Bell className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  待确认的 AI 建议
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  有 {pendingCount} 条分类建议需要您确认
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-200">
                {pendingCount}
              </Badge>
              <ChevronRight className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
          </button>
        </div>
      )}

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
