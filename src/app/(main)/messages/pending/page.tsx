"use client";

/**
 * 待确认消息专页
 * V4.2 半托管模式核心功能
 *
 * @description 专门展示需要用户确认的 AI 建议
 * - 分类确认：低置信度分类需要用户选择
 * - 文件夹操作：创建/合并/拆分/重命名建议
 * - 支持批量操作
 * - 按类型筛选
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmationMessageItem } from "@/components/messages/confirmation-message-item";
import {
  PendingConfirmationFilter,
  type FilterMode,
} from "@/components/messages/pending-confirmation-filter";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Inbox,
  RefreshCw,
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

  // 获取待确认消息
  const fetchConfirmations = async () => {
    try {
      const response = await fetch("/api/confirmations?status=pending");
      if (!response.ok) throw new Error("Failed to fetch confirmations");

      const data = await response.json();
      setConfirmations(data.confirmations || []);
    } catch (error) {
      console.error("Failed to fetch confirmations:", error);
      toast.error("获取待确认消息失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConfirmations();
  }, []);

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
      const response = await fetch(`/api/confirmations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          choice: { selectedFolderId },
        }),
      });

      if (!response.ok) throw new Error("Failed to confirm");

      toast.success("已确认");
      setConfirmations((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to confirm:", error);
      toast.error("确认失败");
    }
  };

  // 处理拒绝
  const handleReject = async (id: number) => {
    try {
      const response = await fetch(`/api/confirmations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!response.ok) throw new Error("Failed to reject");

      toast.success("已拒绝");
      setConfirmations((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to reject:", error);
      toast.error("拒绝失败");
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
            <h1 className="text-2xl font-bold">待确认消息</h1>
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

      {/* 列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConfirmations.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">全部处理完成</CardTitle>
                <CardDescription className="mt-1">
                  {filter === "all"
                    ? "暂无待确认的消息"
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
            <ConfirmationMessageItem
              key={confirmation.id}
              confirmation={confirmation}
              onConfirm={handleConfirm}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {/* 批量操作 */}
      {filteredConfirmations.length > 1 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">
              {filteredConfirmations.length} 条待确认消息
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // 批量拒绝
                  toast.info("批量操作功能开发中");
                }}
              >
                <XCircle className="h-4 w-4 mr-1" />
                全部拒绝
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  // 批量确认
                  toast.info("批量操作功能开发中");
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                全部确认
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
