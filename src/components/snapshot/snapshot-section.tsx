/**
 * SnapshotSection Component (V4.2.1)
 * 快照区域复合组件 - 用于书签详情页的快照展示区
 *
 * 功能：
 * - 整合所有快照相关组件
 * - 显示快照状态和内容
 * - 提供创建/更新/删除操作
 * - 可折叠展示
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SnapshotButton } from "./snapshot-button";
import { SnapshotStatus } from "./snapshot-status";
import { SnapshotViewer } from "./snapshot-viewer";
import type {
  SnapshotStatus as SnapshotStatusType,
  SnapshotType,
} from "@/lib/snapshot";

// ============================================================================
// 类型定义
// ============================================================================

export interface SnapshotInfo {
  id: number;
  status: SnapshotStatusType;
  snapshotType: SnapshotType;
  capturedAt: string | null;
  errorMessage: string | null;
  readableTitle: string | null;
  readableWordCount: number | null;
}

export interface SnapshotSectionProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签 URL */
  bookmarkUrl: string;
  /** 现有快照信息（可选） */
  snapshot?: SnapshotInfo | null;
  /** 默认展开状态 */
  defaultExpanded?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 快照变化回调 */
  onSnapshotChange?: (snapshot: SnapshotInfo | null) => void;
}

// ============================================================================
// 组件实现
// ============================================================================

export function SnapshotSection({
  bookmarkId,
  bookmarkUrl,
  snapshot: initialSnapshot,
  defaultExpanded = false,
  className,
  onSnapshotChange,
}: SnapshotSectionProps) {
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(
    initialSnapshot || null,
  );
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialSnapshot);

  // 同步外部快照数据
  useEffect(() => {
    if (initialSnapshot !== undefined) {
      setSnapshot(initialSnapshot);
      setIsLoading(false);
    }
  }, [initialSnapshot]);

  // 组件挂载时获取现有快照
  useEffect(() => {
    if (initialSnapshot) return; // 如果已有初始数据，跳过

    const loadExistingSnapshot = async () => {
      try {
        const response = await fetch(`/api/snapshots?bookmarkId=${bookmarkId}`);
        const result = await response.json();

        if (response.ok && result.data) {
          const existingSnapshot: SnapshotInfo = {
            id: result.data.id,
            status: result.data.status,
            snapshotType: result.data.snapshotType,
            capturedAt: result.data.capturedAt,
            errorMessage: result.data.errorMessage,
            readableTitle: result.data.readableTitle,
            readableWordCount: result.data.readableWordCount,
          };
          setSnapshot(existingSnapshot);
          onSnapshotChange?.(existingSnapshot);
        }
      } catch (error) {
        console.error("Failed to load existing snapshot:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingSnapshot();
  }, [bookmarkId, initialSnapshot, onSnapshotChange]);

  // 获取快照详情
  const fetchSnapshot = useCallback(async () => {
    if (!snapshot?.id) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/snapshots/${snapshot.id}`);
      const result = await response.json();

      if (response.ok && result.data) {
        const updatedSnapshot: SnapshotInfo = {
          id: result.data.id,
          status: result.data.status,
          snapshotType: result.data.snapshotType,
          capturedAt: result.data.capturedAt,
          errorMessage: result.data.errorMessage,
          readableTitle: result.data.readableTitle,
          readableWordCount: result.data.readableWordCount,
        };
        setSnapshot(updatedSnapshot);
        onSnapshotChange?.(updatedSnapshot);
      }
    } catch (error) {
      console.error("Failed to fetch snapshot:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [snapshot?.id, onSnapshotChange]);

  // 删除快照
  const handleDelete = useCallback(async () => {
    if (!snapshot?.id) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/snapshots/${snapshot.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || "删除失败");
      }

      setSnapshot(null);
      onSnapshotChange?.(null);
      toast.success("快照已删除");
    } catch (error) {
      toast.error("删除失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [snapshot?.id, onSnapshotChange]);

  // 创建成功回调
  const handleCreateSuccess = useCallback(
    (snapshotId: number) => {
      const newSnapshot: SnapshotInfo = {
        id: snapshotId,
        status: "pending",
        snapshotType: "standard",
        capturedAt: null,
        errorMessage: null,
        readableTitle: null,
        readableWordCount: null,
      };
      setSnapshot(newSnapshot);
      onSnapshotChange?.(newSnapshot);

      // 自动展开
      setIsExpanded(true);
    },
    [onSnapshotChange],
  );

  // 加载状态
  if (isLoading) {
    return (
      <div className={cn("border rounded-lg p-4 bg-muted/30", className)}>
        <div className="flex items-center gap-2">
          <Camera className="size-5 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="text-sm font-medium">网页快照</h3>
            <p className="text-xs text-muted-foreground">加载中...</p>
          </div>
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // 无快照状态
  if (!snapshot) {
    return (
      <div className={cn("border rounded-lg p-4 bg-muted/30", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="size-5 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-medium">网页快照</h3>
              <p className="text-xs text-muted-foreground">
                保存网页内容，防止链接失效
              </p>
            </div>
          </div>
          <SnapshotButton
            bookmarkId={bookmarkId}
            url={bookmarkUrl}
            variant="outline"
            size="sm"
            showLabel
            onSuccess={handleCreateSuccess}
          />
        </div>
      </div>
    );
  }

  // 有快照状态
  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn("border rounded-lg", className)}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Camera className="size-5 text-muted-foreground" />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">网页快照</h3>
                <SnapshotStatus
                  status={snapshot.status}
                  errorMessage={snapshot.errorMessage}
                  capturedAt={snapshot.capturedAt}
                  mode="icon"
                  size="sm"
                />
              </div>
              {snapshot.readableTitle && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {snapshot.readableTitle}
                </p>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground ml-2" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground ml-2" />
            )}
          </button>
        </CollapsibleTrigger>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          {/* 刷新状态 */}
          {(snapshot.status === "pending" ||
            snapshot.status === "processing") && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={fetchSnapshot}
              disabled={isRefreshing}
              title="刷新状态"
            >
              {isRefreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          )}

          {/* 更新快照 */}
          {snapshot.status === "completed" && (
            <SnapshotButton
              bookmarkId={bookmarkId}
              url={bookmarkUrl}
              hasSnapshot
              variant="ghost"
              size="icon-sm"
              onSuccess={handleCreateSuccess}
            />
          )}

          {/* 删除快照 */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                title="删除快照"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除快照？</AlertDialogTitle>
                <AlertDialogDescription>
                  删除后将无法恢复此快照内容。如需保留网页内容，请先复制或导出。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 内容区 */}
      <CollapsibleContent>
        <div className="border-t px-4 py-4">
          {snapshot.status === "completed" ? (
            <SnapshotViewer
              snapshotId={snapshot.id}
              originalUrl={bookmarkUrl}
              maxHeight="400px"
            />
          ) : snapshot.status === "pending" ||
            snapshot.status === "processing" ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {snapshot.status === "pending"
                  ? "等待处理..."
                  : "正在抓取网页内容..."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSnapshot}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn(
                    "size-4 mr-1.5",
                    isRefreshing && "animate-spin",
                  )}
                />
                刷新状态
              </Button>
            </div>
          ) : snapshot.status === "failed" ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="text-center">
                <p className="text-sm text-destructive font-medium">
                  快照创建失败
                </p>
                {snapshot.errorMessage && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {snapshot.errorMessage}
                  </p>
                )}
              </div>
              <SnapshotButton
                bookmarkId={bookmarkId}
                url={bookmarkUrl}
                variant="outline"
                size="sm"
                showLabel
                onSuccess={handleCreateSuccess}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <FileText className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">快照已过期</p>
              <SnapshotButton
                bookmarkId={bookmarkId}
                url={bookmarkUrl}
                variant="outline"
                size="sm"
                showLabel
                onSuccess={handleCreateSuccess}
              />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// 导出
// ============================================================================

export default SnapshotSection;
