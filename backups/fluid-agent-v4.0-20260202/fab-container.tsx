'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import {
  PredictionSheet,
  operationExecutor,
  showUndoToast,
} from '@/lib/fluid-agent';
import type { Bookmark } from '@/types/bookmark';
import type { PredictionResult } from '@/lib/fluid-agent';

interface FABContainerProps {
  selection: Bookmark[];
  predictions: PredictionResult[];
  onOperationStart?: (operationId: string) => void;
  onClearSelection?: () => void;
  onAddNew?: () => void;
}

export function FABContainer({
  selection,
  predictions,
  onOperationStart,
  onClearSelection,
  onAddNew,
}: FABContainerProps) {
  const [showSheet, setShowSheet] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasSelection = selection.length > 0;
  const hasPredictions = predictions.length > 0;
  const showMagicMode = hasSelection && hasPredictions;

  // 检查是否有活跃操作（用于上移 FAB）
  const hasActiveOperation = operationExecutor.hasActiveOperation();

  const handleFABClick = () => {
    if (showMagicMode) {
      setShowSheet(true);
    } else {
      // 默认行为: 添加新书签
      onAddNew?.();
    }
  };

  const handleSelectPrediction = async (prediction: PredictionResult) => {
    setShowSheet(false);
    setLoading(true);

    try {
      const result = await operationExecutor.execute(
        prediction.action,
        selection,
        prediction.params
      );

      onOperationStart?.(result.operationId);

      if (result.success) {
        showUndoToast({
          operationId: result.operationId,
          message: `已${prediction.label} ${result.affectedCount} 项`,
          onUndo: onClearSelection,
        });
        onClearSelection?.();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <FloatingActionButton
        icon={showMagicMode ? '✨' : <Plus className="h-6 w-6" />}
        label={showMagicMode ? `${predictions.length}` : undefined}
        onClick={handleFABClick}
        elevated={hasActiveOperation}
        className={showMagicMode ? 'bg-gradient-to-r from-purple-500 to-blue-500' : ''}
        disabled={loading}
      />

      <PredictionSheet
        open={showSheet}
        onOpenChange={setShowSheet}
        predictions={predictions}
        onSelect={handleSelectPrediction}
        loading={loading}
        selectionCount={selection.length}
      />
    </>
  );
}
