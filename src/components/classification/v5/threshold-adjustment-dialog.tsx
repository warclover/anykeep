/**
 * 智能分类 v5.0 - 阈值调整对话框
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircleIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import type { ThresholdAdjustment } from '@/lib/classification/v5/gardener/types';

interface ThresholdAdjustmentDialogProps {
  /** 是否打开对话框 */
  open: boolean;
  /** 关闭对话框回调 */
  onOpenChange: (open: boolean) => void;
  /** 阈值调整建议 */
  adjustment: ThresholdAdjustment;
  /** 应用调整回调 */
  onApply: () => void;
  /** 是否正在应用 */
  isApplying?: boolean;
}

export function ThresholdAdjustmentDialog({
  open,
  onOpenChange,
  adjustment,
  onApply,
  isApplying = false,
}: ThresholdAdjustmentDialogProps) {
  const isIncrease = adjustment.suggestedThreshold > adjustment.currentThreshold;
  const change = Math.abs(
    adjustment.suggestedThreshold - adjustment.currentThreshold
  );
  const changePercent = Math.round((change / adjustment.currentThreshold) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircleIcon className="h-5 w-5 text-blue-600" />
            阈值调整建议
          </DialogTitle>
          <DialogDescription>
            基于您的分类历史数据，系统建议调整置信度阈值以优化分类效果
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 调整方向 */}
          <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">当前阈值</p>
              <p className="text-2xl font-bold">
                {adjustment.currentThreshold.toFixed(2)}
              </p>
            </div>
            <div className="flex flex-col items-center">
              {isIncrease ? (
                <TrendingUpIcon className="h-8 w-8 text-green-600" />
              ) : (
                <TrendingDownIcon className="h-8 w-8 text-blue-600" />
              )}
              <span className="text-xs text-muted-foreground mt-1">
                {isIncrease ? '提高' : '降低'} {changePercent}%
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">建议阈值</p>
              <p className="text-2xl font-bold text-primary">
                {adjustment.suggestedThreshold.toFixed(2)}
              </p>
            </div>
          </div>

          {/* 调整原因 */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              调整原因
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {adjustment.reason}
            </p>
          </div>

          {/* 支持数据 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">支持数据</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted rounded text-sm">
                <p className="text-muted-foreground">总分类次数</p>
                <p className="font-semibold">
                  {adjustment.supportingData.totalClassifications}
                </p>
              </div>
              <div className="p-2 bg-muted rounded text-sm">
                <p className="text-muted-foreground">平均准确率</p>
                <p className="font-semibold">
                  {Math.round(adjustment.supportingData.averageAccuracy * 100)}%
                </p>
              </div>
              <div className="p-2 bg-muted rounded text-sm">
                <p className="text-muted-foreground">T1 纠正率</p>
                <p className="font-semibold">
                  {Math.round(adjustment.supportingData.t1CorrectionRate * 100)}%
                </p>
              </div>
              <div className="p-2 bg-muted rounded text-sm">
                <p className="text-muted-foreground">用户纠正率</p>
                <p className="font-semibold">
                  {Math.round(adjustment.supportingData.userCorrectionRate * 100)}%
                </p>
              </div>
            </div>
          </div>

          {/* 置信度 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">建议置信度</span>
            <Badge variant="secondary">
              {Math.round(adjustment.confidence * 100)}%
            </Badge>
          </div>

          {/* 影响说明 */}
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
              影响说明
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {isIncrease
                ? '提高阈值将使分类更加保守，减少自动分类但提高准确性，更多书签会触发 T1 深度分析。'
                : '降低阈值将使分类更加激进，增加自动分类速度但可能降低准确性，减少 T1 深度分析的触发。'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            取消
          </Button>
          <Button onClick={onApply} disabled={isApplying}>
            {isApplying ? '应用中...' : '应用调整'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
