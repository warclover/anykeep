"use client";

/**
 * 待确认消息专页
 * V4.3 待办中心 - 内联操作、批量处理
 *
 * @description 专门展示需要用户确认的 AI 建议
 * - 分类确认：低置信度分类需要用户选择
 * - 文件夹操作：创建/合并/拆分/重命名建议
 * - 支持批量操作（全部确认/全部拒绝）
 * - 内联操作按钮
 * - 按类型筛选
 *
 * @version 1.1.0
 * @since 2025-12-12
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { clientLogger } from "@/lib/client-logger";
import { API_CONFIRMATIONS } from "@/lib/constants/api-paths";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmationMessageItem } from "@/components/messages/confirmation-message-item";
import {
  PendingConfirmationFilter,
  type FilterMode,
} from "@/components/messages/pending-confirmation-filter";
import {
  XCircle,
  ArrowLeft,
  Inbox,
  RefreshCw,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { ConfirmationMessageDisplay } from "@/types/confirmation";

// ============================================================================
// 主组件
// ============================================================================

export default function PendingConfirmationsPage() {
  const router = useRouter();
  const [confirmations, setConfirmations] = useState<
    ConfirmationMessageDisplay[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // 获取待确认消息
  const fetchConfirmations = useCallback(async () => {
    try {
      const response = await fetch(`${API_CONFIRMATIONS.list}?status=pending`);
      if (!response.ok) throw new Error("Failed to fetch confirmations");

      const data = await response.json();
      setConfirmations(data.confirmations || []);
    } catch (error) {
      clientLogger.error({ error }, "Failed to fetch confirmations");
      toast.error("获取待确认消息失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConfirmations();
  }, [fetchConfirmations]);

  // 刷新
  const handleRefresh = () => {
    setRefreshing(true);
    fetchConfirmations();
  };

  // 处理确认
  const handleConfirm = async (
    id: number,
    selectedFolderId?: number | null,
  ) => {
    try {
      const response = await fetch(API_CONFIRMATIONS.detail(String(id)), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          choice: { selectedFolderId },
        }),
      });

      if (!response.ok) throw new Error("Failed to confirm");

      toast.success("已确认分类");
      setConfirmations((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      clientLogger.error({ error, confirmationId: id }, "Failed to confirm");
      toast.error("确认失败");
    }
  };

  // 处理拒绝
  const handleReject = async (id: number) => {
    try {
      const response = await fetch(API_CONFIRMATIONS.detail(String(id)), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      toast.success("已移至待整理");
      setConfirmations((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      clientLogger.error({ error, confirmationId: id }, "Failed to reject");
      toast.error("拒绝失败");
    }
  };

  // 选择/取消选择
  const handleToggleSelect = (id: number) => {
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

  // 全选/取消全选
  const handleSelectAll = () => {
    const currentFilteredIds = filteredConfirmations.map((c) => c.id);
    const allSelected = currentFilteredIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentFilteredIds));
    }
  };

  // 批量确认
  const handleBatchConfirm = async () => {
    const idsToProcess =
      selectedIds.size > 0
        ? Array.from(selectedIds)
        : filteredConfirmations.map((c) => c.id);

    if (idsToProcess.length === 0) return;

    setBatchProcessing(true);
    try {
      const response = await fetch(API_CONFIRMATIONS.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          ids: idsToProcess,
        }),
      });

      if (!response.ok) throw new Error("Failed to batch confirm");

      const result = await response.json();
      toast.success(`已确认 ${result.success} 条`);

      // 刷新列表
      await fetchConfirmations();
      setSelectedIds(new Set());
    } catch (error) {
      clientLogger.error(
        { error, count: idsToProcess.length },
        "Batch confirm failed",
      );
      toast.error("批量确认失败");
    } finally {
      setBatchProcessing(false);
    }
  };

  // 批量拒绝
  const handleBatchReject = async () => {
    const idsToProcess =
      selectedIds.size > 0
        ? Array.from(selectedIds)
        : filteredConfirmations.map((c) => c.id);

    if (idsToProcess.length === 0) return;

    setBatchProcessing(true);
    try {
      const response = await fetch(API_CONFIRMATIONS.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          ids: idsToProcess,
        }),
      });

      if (!response.ok) throw new Error("Failed to batch reject");

      const result = await response.json();
      toast.success(`已拒绝 ${result.success} 条`);

      // 刷新列表
      await fetchConfirmations();
      setSelectedIds(new Set());
    } catch (error) {
      clientLogger.error(
        { error, count: idsToProcess.length },
        "Batch reject failed",
      );
      toast.error("批量拒绝失败");
    } finally {
      setBatchProcessing(false);
    }
  };

  // 筛选（本页面只显示 pending 状态，所以 "all" 和 "pending" 行为相同）
  const filteredConfirmations =
    filter === "all" || filter === "pending"
      ? confirmations
      : confirmations.filter((c) => c.type === filter);

  // 统计
  const stats = {
    total: confirmations.length,
    classification: confirmations.filter((c) => c.type === "classification")
      .length,
    folder_create: confirmations.filter((c) => c.type === "folder_create")
      .length,
    folder_merge: confirmations.filter((c) => c.type === "folder_merge").length,
    folder_split: confirmations.filter((c) => c.type === "folder_split").length,
    folder_rename: confirmations.filter((c) => c.type === "folder_rename")
      .length,
  };

  const filteredIds = filteredConfirmations.map((c) => c.id);
  const isAllSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/messages")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">待办中心</h1>
            <p className="text-sm text-muted-foreground">AI 建议需要您的确认</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">{stats.total} 条待处理</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`}
            />
            刷新
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <PendingConfirmationFilter
        mode={filter}
        onModeChange={setFilter}
        pendingCount={stats.total}
        typeCounts={{
          classification: stats.classification,
          folder_create: stats.folder_create,
          folder_merge: stats.folder_merge,
          folder_split: stats.folder_split,
          folder_rename: stats.folder_rename,
        }}
      />

      {/* 批量操作栏 */}
      {filteredConfirmations.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              aria-label="全选"
            />
            <span className="text-sm text-muted-foreground">
              {hasSelection
                ? `已选 ${selectedIds.size} 条`
                : `全选 ${filteredConfirmations.length} 条`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchReject}
              disabled={batchProcessing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {hasSelection ? "拒绝所选" : "全部拒绝"}
            </Button>
            <Button
              size="sm"
              onClick={handleBatchConfirm}
              disabled={batchProcessing}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              {hasSelection ? "确认所选" : "全部确认"}
            </Button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : filteredConfirmations.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">太棒了！</CardTitle>
                <CardDescription className="mt-1">
                  {filter === "all"
                    ? "没有待处理事项，AI 会继续帮你整理收藏"
                    : "该类型暂无待确认消息"}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/messages")}
              >
                <Inbox className="h-4 w-4 mr-2" />
                返回消息列表
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredConfirmations.map((confirmation) => (
            <div key={confirmation.id} className="relative">
              {/* 选择框覆盖层 */}
              <div className="absolute left-3 top-4 z-10">
                <Checkbox
                  checked={selectedIds.has(confirmation.id)}
                  onCheckedChange={() => handleToggleSelect(confirmation.id)}
                  aria-label={`选择 ${confirmation.title}`}
                />
              </div>
              <div className="pl-10">
                <ConfirmationMessageItem
                  confirmation={confirmation}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
