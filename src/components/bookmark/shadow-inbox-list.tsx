/**
 * 影子分拣收件箱列表组件
 * 用于 Shadow Sorting (Inbox Zero) 功能
 * 显示待处理的分类建议列表
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { Loader2, Inbox } from "lucide-react";
import { ShadowBookmarkCard } from "./shadow-bookmark-card";
import { ShadowBatchToolbar } from "./shadow-batch-toolbar";
import { useToast } from "@/hooks/use-toast";

interface ShadowBookmark {
  id: number;
  title: string;
  url: string;
  shadowFolderId: number;
  shadowFolderName: string;
  shadowConfidence: number;
  shadowSuggestedAt: string;
}

interface ShadowInboxStats {
  pendingCount: number;
  avgConfidence: number;
}

interface ShadowInboxListProps {
  height?: string;
}

/**
 * 影子分拣收件箱列表
 */
export function ShadowInboxList({
  height = "calc(100vh - 320px)",
}: ShadowInboxListProps) {
  const { toast } = useToast();
  const [bookmarks, setBookmarks] = useState<ShadowBookmark[]>([]);
  const [stats, setStats] = useState<ShadowInboxStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperating, setIsOperating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 加载待处理列表
  const loadInbox = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/classification/v5/shadow/inbox");

      if (!response.ok) {
        throw new Error("Failed to load inbox");
      }

      const result = await response.json();

      if (result.success) {
        setBookmarks(result.data.bookmarks);
        setStats(result.data.stats);
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Failed to load shadow inbox:", error);
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // 初始加载
  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // 全选
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(bookmarks.map((b) => b.id)));
  }, [bookmarks]);

  // 取消全选
  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 切换选中状态
  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 单个确认
  const handleConfirmOne = useCallback(
    async (id: number) => {
      try {
        setIsOperating(true);
        const response = await fetch("/api/classification/v5/shadow/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkIds: [id] }),
        });

        if (!response.ok) {
          throw new Error("Failed to confirm");
        }

        const result = await response.json();

        if (result.success) {
          // 从列表中移除
          setBookmarks((prev) => prev.filter((b) => b.id !== id));
          toast({
            title: "确认成功",
            description: "书签已移动到建议的文件夹",
          });
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (error) {
        console.error("Failed to confirm:", error);
        toast({
          title: "确认失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      } finally {
        setIsOperating(false);
      }
    },
    [toast],
  );

  // 单个拒绝
  const handleRejectOne = useCallback(
    async (id: number) => {
      try {
        setIsOperating(true);
        const response = await fetch("/api/classification/v5/shadow/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkIds: [id] }),
        });

        if (!response.ok) {
          throw new Error("Failed to reject");
        }

        const result = await response.json();

        if (result.success) {
          // 从列表中移除
          setBookmarks((prev) => prev.filter((b) => b.id !== id));
          toast({
            title: "已拒绝",
            description: "书签保持在当前位置",
          });
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (error) {
        console.error("Failed to reject:", error);
        toast({
          title: "拒绝失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      } finally {
        setIsOperating(false);
      }
    },
    [toast],
  );

  // 批量确认
  const handleBatchConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsOperating(true);
      const bookmarkIds = Array.from(selectedIds);

      const response = await fetch("/api/classification/v5/shadow/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to batch confirm");
      }

      const result = await response.json();

      if (result.success) {
        const { summary } = result.data;

        // 从列表中移除成功的书签
        setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)));
        setSelectedIds(new Set());

        toast({
          title: "批量确认完成",
          description: `成功: ${summary.success} 个，失败: ${summary.failure} 个`,
        });
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Failed to batch confirm:", error);
      toast({
        title: "批量确认失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsOperating(false);
    }
  }, [selectedIds, toast]);

  // 批量拒绝
  const handleBatchReject = useCallback(async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsOperating(true);
      const bookmarkIds = Array.from(selectedIds);

      const response = await fetch("/api/classification/v5/shadow/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to batch reject");
      }

      const result = await response.json();

      if (result.success) {
        const { summary } = result.data;

        // 从列表中移除成功的书签
        setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)));
        setSelectedIds(new Set());

        toast({
          title: "批量拒绝完成",
          description: `成功: ${summary.success} 个，失败: ${summary.failure} 个`,
        });
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Failed to batch reject:", error);
      toast({
        title: "批量拒绝失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsOperating(false);
    }
  }, [selectedIds, toast]);

  // 是否处于批量选择模式
  const isSelectionMode = selectedIds.size > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Inbox className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">收件箱已清空</p>
        <p className="text-sm">暂无待处理的分类建议</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      {stats && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>待处理: {stats.pendingCount} 个</span>
          <span>平均置信度: {Math.round(stats.avgConfidence * 100)}%</span>
        </div>
      )}

      {/* 批量操作工具栏 */}
      <ShadowBatchToolbar
        totalCount={bookmarks.length}
        selectedCount={selectedIds.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBatchConfirm={handleBatchConfirm}
        onBatchReject={handleBatchReject}
        isLoading={isOperating}
      />

      {/* 虚拟滚动列表 */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Virtuoso
          style={{ height }}
          data={bookmarks}
          itemContent={(index, bookmark) => (
            <div className="p-2">
              <ShadowBookmarkCard
                bookmark={bookmark}
                onConfirm={handleConfirmOne}
                onReject={handleRejectOne}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(bookmark.id)}
                onToggleSelect={handleToggleSelect}
              />
            </div>
          )}
          overscan={200}
          increaseViewportBy={{ top: 400, bottom: 400 }}
        />
      </div>
    </div>
  );
}
