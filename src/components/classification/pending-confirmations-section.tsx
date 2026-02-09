"use client";

/**
 * Pending Confirmations Section
 * V4.2 待确认消息区域组件
 * V4.2.24: 使用 useFolders Hook 统一缓存
 *
 * @description 展示和管理待确认的分类建议
 * - 获取待确认消息列表
 * - 支持单个和批量操作
 * - 集成学习反馈
 *
 * @version 1.1.0
 * @since 2025-12-11
 */

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { fetchWithRetry } from "@/lib/utils/fetch-with-retry";
import { useFolders } from "@/hooks/data";
import { clientLogger } from "@/lib/client-logger";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

// ============================================================================
// 类型定义
// ============================================================================

interface PendingConfirmationsSectionProps {
  className?: string;
}

interface ApiConfirmation {
  id: number;
  bookmarkId: number | null;
  type: string;
  status: string;
  suggestion: {
    folderId: number | null;
    folderName: string | null;
    confidence: number;
    reason: string | null;
  };
  metadata: Record<string, unknown> | null;
  expiresAt: string | null;
  createdAt: string;
  // 关联数据（可选，需要 API 支持）
  bookmark?: {
    title: string;
    url: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // V4.2.24: 使用统一的文件夹缓存 Hook
  const { folders: rawFolders } = useFolders();

  // 转换文件夹数据格式
  const folders = useMemo<FolderOption[]>(() => {
    if (!rawFolders) return [];
    return rawFolders.map((f) => ({
      id: f.id,
      name: f.name,
    }));
  }, [rawFolders]);

  // V4.2.24: 获取待确认消息（文件夹数据由 useFolders Hook 提供）
  const fetchConfirmations = useCallback(async () => {
    try {
      // 使用 fetchWithRetry 处理偶发的 401 错误
      const confirmationsRes = await fetchWithRetry(
        API_CLASSIFICATION.confirmations + "?status=pending",
        undefined,
        { requestId: "confirmations-list" },
      );

      if (confirmationsRes.ok) {
        const confirmationsData = await confirmationsRes.json();
        // API 返回 { success, data: { confirmations, total, ... } }
        const confirmations = confirmationsData.data?.confirmations || [];
        const transformedMessages: ConfirmationMessage[] = confirmations.map(
          (c: ApiConfirmation) => ({
            id: c.id,
            bookmarkId: c.bookmarkId || 0,
            bookmarkTitle:
              c.bookmark?.title ||
              (c.metadata?.bookmarkTitle as string) ||
              "无标题",
            bookmarkUrl:
              c.bookmark?.url || (c.metadata?.bookmarkUrl as string) || "",
            suggestedFolderId: c.suggestion.folderId || 0,
            suggestedFolderName: c.suggestion.folderName || "未知文件夹",
            confidence: c.suggestion.confidence,
            reason: c.suggestion.reason || "",
            status: c.status as ConfirmationMessage["status"],
            createdAt: c.createdAt,
            expiresAt: c.expiresAt || "",
          }),
        );
        setMessages(transformedMessages);
      }
    } catch (error) {
      clientLogger.error({ error }, "Failed to fetch confirmations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchConfirmations();
  }, [fetchConfirmations]);

  // V4.2.1: 处理确认（带重试）
  const handleConfirm = async (messageId: number) => {
    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationDetail(messageId.toString()),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm" }),
        },
        { requestId: `confirm-${messageId}` },
      );

      if (!res.ok) throw new Error("确认失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已确认");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // V4.2.1: 处理拒绝（带重试）
  const handleReject = async (messageId: number) => {
    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationDetail(messageId.toString()),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject" }),
        },
        { requestId: `reject-${messageId}` },
      );

      if (!res.ok) throw new Error("拒绝失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已拒绝");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // V4.2.1: 处理修改（使用不同的文件夹确认，带重试）
  const handleModify = async (messageId: number, newFolderId: number) => {
    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationDetail(messageId.toString()),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            selectedFolderId: newFolderId,
          }),
        },
        { requestId: `modify-${messageId}` },
      );

      if (!res.ok) throw new Error("修改失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已修改");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // V4.2.1: 批量确认（带重试）
  const handleConfirmAll = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationsBatch,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: ids.map((id) => ({
              confirmationId: id,
              action: "confirm",
            })),
          }),
        },
        { requestId: "batch-confirm" },
      );

      if (!res.ok) throw new Error("批量确认失败");

      const result = await res.json();
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      toast.success(
        `已确认 ${result.data?.summary?.success || ids.length} 条分类`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  };

  // V4.2.1: 批量拒绝（带重试）
  const handleRejectAll = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationsBatch,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: ids.map((id) => ({
              confirmationId: id,
              action: "reject",
            })),
          }),
        },
        { requestId: "batch-reject" },
      );

      if (!res.ok) throw new Error("批量拒绝失败");

      const result = await res.json();
      setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      toast.success(
        `已拒绝 ${result.data?.summary?.success || ids.length} 条分类`,
      );
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

  // 数据就绪前或没有待确认消息时，不渲染任何 UI（后台静默加载）
  if (isLoading || messages.length === 0) {
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
                    selectedIds.has(message.id) &&
                      "ring-2 ring-primary rounded-lg",
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
