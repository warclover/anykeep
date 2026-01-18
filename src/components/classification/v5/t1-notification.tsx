/**
 * 智能分类 v5.0 - T1 纠正通知组件
 *
 * 功能：
 * - 显示 T1 LLM 纠正结果
 * - 对比 T0 和 T1 的分类差异
 * - 展示 LLM 推理理由
 * - 提供用户确认或拒绝选项
 */

'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * T1 纠正通知属性
 */
interface T1NotificationProps {
  /** T0 原始文件夹 ID */
  t0FolderId: string;
  /** T0 原始文件夹名称 */
  t0FolderName: string;
  /** T0 置信度 */
  t0Confidence: number;
  /** T1 纠正后文件夹 ID */
  t1FolderId: string;
  /** T1 纠正后文件夹名称 */
  t1FolderName: string;
  /** T1 置信度 */
  t1Confidence: number;
  /** LLM 推理理由 */
  reasoning: string;
  /** 书签 ID */
  bookmarkId: string;
  /** 确认回调 */
  onAccept?: () => void;
  /** 拒绝回调 */
  onReject?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * T1 纠正通知组件
 */
export function T1Notification({
  t0FolderId,
  t0FolderName,
  t0Confidence,
  t1FolderId,
  t1FolderName,
  t1Confidence,
  reasoning,
  bookmarkId: _bookmarkId,
  onAccept,
  onReject,
  onClose,
}: T1NotificationProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // 如果已关闭，不显示
  if (isDismissed) {
    return null;
  }

  // 判断是否有变化
  const hasChange = t0FolderId !== t1FolderId;

  // 置信度提升
  const confidenceImprovement = t1Confidence - t0Confidence;

  /**
   * 处理接受操作
   */
  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      if (onAccept) {
        await onAccept();
      }
      setIsDismissed(true);
    } catch (error) {
      console.error('Failed to accept T1 correction:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 处理拒绝操作
   */
  const handleReject = async () => {
    setIsProcessing(true);
    try {
      if (onReject) {
        await onReject();
      }
      setIsDismissed(true);
    } catch (error) {
      console.error('Failed to reject T1 correction:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 处理关闭操作
   */
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    setIsDismissed(true);
  };

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base">AI 智能纠正建议</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          {hasChange
            ? 'AI 分析后建议调整分类结果'
            : 'AI 确认了初始分类结果'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 分类对比 */}
        <div className="flex items-center gap-3">
          {/* T0 结果 */}
          <div className="flex-1 space-y-1">
            <div className="text-xs text-muted-foreground">初始分类 (T0)</div>
            <Badge variant="outline" className="font-normal">
              {t0FolderName}
            </Badge>
            <div className="text-xs text-muted-foreground">
              置信度: {(t0Confidence * 100).toFixed(0)}%
            </div>
          </div>

          {/* 箭头 */}
          {hasChange && (
            <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          )}

          {/* T1 结果 */}
          <div className="flex-1 space-y-1">
            <div className="text-xs text-muted-foreground">
              {hasChange ? 'AI 建议 (T1)' : 'AI 确认 (T1)'}
            </div>
            <Badge
              variant={hasChange ? 'default' : 'outline'}
              className={hasChange ? 'bg-blue-600' : 'font-normal'}
            >
              {t1FolderName}
            </Badge>
            <div className="text-xs text-muted-foreground">
              置信度: {(t1Confidence * 100).toFixed(0)}%
              {confidenceImprovement > 0 && (
                <span className="ml-1 text-green-600">
                  (+{(confidenceImprovement * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* LLM 推理理由 */}
        {reasoning && (
          <div className="rounded-md bg-white p-3 dark:bg-gray-900">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              AI 分析理由
            </div>
            <p className="text-sm text-foreground">{reasoning}</p>
          </div>
        )}

        {/* 操作按钮 */}
        {hasChange && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex-1"
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              采纳建议
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              disabled={isProcessing}
              className="flex-1"
            >
              <XCircle className="mr-1 h-4 w-4" />
              保持原分类
            </Button>
          </div>
        )}

        {!hasChange && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleClose}
            className="w-full"
          >
            知道了
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
