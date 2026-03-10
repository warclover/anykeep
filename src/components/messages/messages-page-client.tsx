/**
 * 消息页面客户端组件
 * @description 用于 Keep-Alive 导航系统的消息页面入口
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_CONFIRMATIONS } from "@/lib/constants/api-paths";
import {
  CheckCheck,
  RefreshCw,
  ChevronRight,
  Activity,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageList } from "./message-list";
import { MessageFilter } from "./message-filter";
import { useMessages } from "@/hooks/data";
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
        const res = await fetch(
          `${API_CONFIRMATIONS.list}?status=pending&limit=1`,
        );
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

      {/* V4.3: 快捷入口 */}
      <div className="px-4 sm:px-6 py-3 border-b space-y-2">
        {/* 待办中心入口 */}
        <button
          onClick={() => router.push("/messages/pending")}
          className="w-full flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Inbox className="size-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">待办中心</p>
              <p className="text-xs text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} 条 AI 建议待确认`
                  : "暂无待处理事项"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge variant="default">{pendingCount}</Badge>
            )}
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </button>

        {/* 活动日志入口 */}
        <button
          onClick={() => router.push("/activity")}
          className="w-full flex items-center justify-between p-3 bg-muted/50 border rounded-lg hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">活动日志</p>
              <p className="text-xs text-muted-foreground">
                查看历史操作和 AI 报告
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
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
