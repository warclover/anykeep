'use client';

import { toast } from 'sonner';
import { snapshotManager } from '../../execution/snapshot-manager';

interface UndoToastOptions {
  operationId: string;
  message: string;
  duration?: number;
  onUndo?: () => void;
}

/**
 * 显示带撤销功能的 Toast
 */
export function showUndoToast({
  operationId,
  message,
  duration = 10000,
  onUndo,
}: UndoToastOptions): void {
  let dismissed = false;

  const toastId = toast.success(message, {
    duration,
    action: {
      label: '撤销',
      onClick: async () => {
        if (dismissed) return;
        dismissed = true;

        // 显示撤销中状态
        toast.loading('正在撤销...', { id: toastId });

        try {
          const result = await snapshotManager.rollback(operationId);

          if (result.success) {
            toast.success('已撤销，恢复到操作前状态', { id: toastId });
            onUndo?.();
          } else {
            toast.error(`撤销失败: ${result.error}`, { id: toastId });
          }
        } catch (error) {
          toast.error('撤销失败，请刷���页面', { id: toastId });
        }
      },
    },
  });
}

/**
 * React 组件版本（可选）
 */
export function UndoToastProvider() {
  // 可用于管理多个撤销 Toast 的状态
  return null;
}
