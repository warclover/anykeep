"use client";

/**
 * Pending Confirmations Section
 * V4.2 待确认消息区域组件
 *
 * @description 展示和管理待确认的分类建议
 * - 获取待确认消息列表
 * - 支持单个和批量操作
 * - 集成学习反馈
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ConfirmationMessageCard,
  BatchConfirmationBar,
  type ConfirmationMessage,
  type FolderOption,
} from "./confirmation-message-card";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

interface PendingConfirmationsSectionProps {
  className?: string;
}

interface ApiConfirmation {
  id: number;
  bookmark_id: number;
  suggested_folder_id: number;
  confidence: number;
  reason: string;
  status: string;
  created_at: string;
  expires_at: string;
  bookmarks?: {
    title: string;
    url: string;
  };
  folders?: {
    name: string;
  };
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * 待确认消息区域
 */
export function PendingConfirmationsSection({
  className,
}: PendingConfirmationsSectionProps) {
  const [messages, setMessages] = useState<ConfirmationMessage[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 获取待确认消息
  const fetchConfirmations = useCallback(async () => {
    try {
      const [confirmationsRes, foldersRes] = await Promise.all([
        fetch("/api/classification/confirmations?status=pending"),
        fetch("/api/folders"),
      ]);

      if (confirmationsRes.ok) {
        const confirmationsData = await confirmationsRes.json();
        const transformedMessages: ConfirmationMessage[] = (
          confirmationsData.data || []
        ).map((c: ApiConfirmation) => ({
          id: c.id,
          bookmarkId: c.bookmark_id,
          bookmarkTitle: c.bookmarks?.title || "无标题",
          bookmarkUrl: c.bookmarks?.url || "",
          suggestedFolderId: c.suggested_folder_id,
          suggestedFolderName: c.folders?.name || "未知文件夹",
          confidence: c.confidence,
          reason: c.reason,
          status: c.status as ConfirmationMessage["status"],
          createdAt: c.created_at,
          expiresAt: c.expires_at,
        }));
        setMessages(transformedMessages);
      }

      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(
          (foldersData.data || []).map((f: { id: number; name: string }) => ({
            id: f.id,
            name: f.name,
          })),
        );
      }
    } catch (error) {
      console.error("Failed to fetch confirmations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchConfirmations();
  }, [fetchConfirmations]);

  // 处理确认
  const handleConfirm = async (messageId: number) => {
    try {
      const res = await fetch(`/api/classification/confirmations/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });

      if (!res.ok) throw new Error("确认失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已确认");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // 处理拒绝
  const handleReject = async (messageId: number) => {
    try {
      const res = await fetch(`/api/classification/confirmations/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!res.ok) throw new Error("拒绝失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已拒绝");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // 处理修改
  const handleModify = async (messageId: number, newFolderId: number) => {
    try {
      const res = await fetch(`/api/classification/confirmations/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "modify", newFolderId }),
      });

      if (!res.ok) throw new Error("修改失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已修改");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // 批量确认
  const handleConfirmAll = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const res = await fetch("/api/classification/confirmations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: ids.map((id) => ({ confirmationId: id, action: "confirm" })),
        }),
      });

      if (!res.ok) throw new Error("批量确认失败");

      const result = await res.json();
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      toast.success(`已确认 ${result.data?.summary?.success || ids.length} 条分类`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // 批量拒绝
  const handleRejectAll = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const res = await fetch("/api/classification/confirmations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: ids.map((id) => ({ confirmationId: id, action: "reject" })),
        }),
      });

      if (!res.ok) throw new Error("批量拒绝失败");

      const result = await res.json();
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      toast.success(`已拒绝 ${result.data?.summary?.success || ids.length} 条分类`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // 切换选择
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 如果没有待确认消息，不显示
  if (!isLoading && messages.length === 0) {
    return null;
  }

  return (
    <div className={cn("mb-4", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            >
              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-900 dark:text-amber-100">
                待确认的分类建议
              </span>
              <Badge
                variant="secondary"
                className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  messages.length
                )}
              </Badge>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 ml-1" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-1" />
              )}
            </Button>
          </CollapsibleTrigger>

          {messages.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedIds.size === messages.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(messages.map((m) => m.id)));
                }
              }}
              className="text-xs"
            >
              {selectedIds.size === messages.length ? "取消全选" : "全选"}
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "relative",
                    selectedIds.has(message.id) && "ring-2 ring-primary rounded-lg",
                  )}
                  onClick={() => toggleSelect(message.id)}
                >
                  <ConfirmationMessageCard
                    message={message}
                    folders={folders}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    onModify={handleModify}
                  />
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* 批量操作栏 */}
      <BatchConfirmationBar
        selectedCount={selectedIds.size}
        onConfirmAll={handleConfirmAll}
        onRejectAll={handleRejectAll}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
