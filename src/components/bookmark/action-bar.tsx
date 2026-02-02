"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, FolderInput, Tags, X } from "lucide-react";
import {
  PredictionButton,
  DeleteConfirmDialog,
  operationExecutor,
  showUndoToast,
  sanitizeLabel,
} from "@/lib/fluid-agent";
import type { Bookmark } from "@/types/bookmark";
import type { PredictionResult } from "@/lib/fluid-agent";

interface ActionBarProps {
  selection: Bookmark[];
  predictions: PredictionResult[];
  onClearSelection: () => void;
  onOperationStart?: (operationId: string) => void;
  onDelete?: (bookmarkIds: string[]) => void;
  onMove?: (bookmarkIds: string[]) => void;
  onTag?: (bookmarkIds: string[]) => void;
}

export function ActionBar({
  selection,
  predictions,
  onClearSelection,
  onOperationStart,
  onDelete,
  onMove,
  onTag,
}: ActionBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePredictionClick = async (prediction: PredictionResult) => {
    setLoading(true);
    try {
      const result = await operationExecutor.execute(
        prediction.action,
        selection,
        prediction.params,
      );
      onOperationStart?.(result.operationId);

      if (result.success) {
        showUndoToast({
          operationId: result.operationId,
          message: `已${sanitizeLabel(prediction.label)} ${result.affectedCount} 项`,
          onUndo: onClearSelection,
        });
        onClearSelection();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = () => {
    onDelete?.(selection.map((b) => b.id));
    setShowDeleteConfirm(false);
    onClearSelection();
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur animate-in slide-in-from-bottom">
        <div className="container flex h-16 items-center justify-between">
          {/* 左侧: 选中计数 + 取消 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              已选择 {selection.length} 项
            </span>
            <Button variant="ghost" size="icon" onClick={onClearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 中间: 常规操作 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMove?.(selection.map((b) => b.id))}
            >
              <FolderInput className="mr-2 h-4 w-4" />
              移动
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTag?.(selection.map((b) => b.id))}
            >
              <Tags className="mr-2 h-4 w-4" />
              标签
            </Button>
          </div>

          {/* 右侧: 智能推荐 */}
          <div className="flex items-center gap-2">
            {predictions.slice(0, 2).map((prediction) => (
              <PredictionButton
                key={prediction.ruleId}
                prediction={prediction}
                onClick={() => handlePredictionClick(prediction)}
                loading={loading}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemCount={selection.length}
        itemType="bookmark"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
