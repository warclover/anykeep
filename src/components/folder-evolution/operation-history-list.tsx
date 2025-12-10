"use client";

/**
 * 操作历史列表组件
 */

import { useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationHistoryItem } from "./operation-history-item";
import { OperationDetailDialog } from "./operation-detail-dialog";
import { UndoConfirmDialog } from "./undo-confirm-dialog";
import type { OperationDetail } from "@/types/supabase";

interface OperationHistoryListProps {
  operations: OperationDetail[];
  isLoading?: boolean;
  error?: Error | null;
  onUndo: (id: string) => Promise<void>;
  onRefresh: () => void;
  undoableCount?: number;
}

export function OperationHistoryList({
  operations,
  isLoading = false,
  error,
  onUndo,
  onRefresh,
  undoableCount = 0,
}: OperationHistoryListProps) {
  const [selectedOperation, setSelectedOperation] = useState<OperationDetail | null>(null);
  const [operationToUndo, setOperationToUndo] = useState<OperationDetail | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const handleViewDetail = (id: string) => {
    const operation = operations.find((op) => op.id === id);
    if (operation) {
      setSelectedOperation(operation);
    }
  };

  const handleUndoClick = (id: string) => {
    const operation = operations.find((op) => op.id === id);
    if (operation) {
      setOperationToUndo(operation);
    }
  };

  const handleConfirmUndo = async () => {
    if (!operationToUndo) return;

    setIsUndoing(true);
    try {
      await onUndo(operationToUndo.id);
      setOperationToUndo(null);
    } finally {
      setIsUndoing(false);
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error.message}</p>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  // 空状态
  if (operations.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">暂无操作记录</h3>
        <p className="text-sm text-muted-foreground">
          AI 对文件夹的操作会显示在这里
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {undoableCount > 0 && (
            <span className="text-primary font-medium">
              {undoableCount} 项操作可撤销
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-1" />
          刷新
        </Button>
      </div>

      {/* 操作列表 */}
      <div className="space-y-2">
        {operations.map((operation) => (
          <OperationHistoryItem
            key={operation.id}
            operation={operation}
            onUndo={handleUndoClick}
            onViewDetail={handleViewDetail}
            isUndoing={isUndoing && operationToUndo?.id === operation.id}
          />
        ))}
      </div>

      {/* 详情对话框 */}
      <OperationDetailDialog
        operation={selectedOperation}
        open={!!selectedOperation}
        onOpenChange={(open) => !open && setSelectedOperation(null)}
      />

      {/* 撤销确认对话框 */}
      <UndoConfirmDialog
        operation={operationToUndo}
        open={!!operationToUndo}
        onOpenChange={(open) => !open && setOperationToUndo(null)}
        onConfirm={handleConfirmUndo}
        isLoading={isUndoing}
      />
    </div>
  );
}
