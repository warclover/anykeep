/**
 * 智能分类 v5.0 - 分类结果卡片
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderIcon, ClockIcon, CheckCircleIcon } from 'lucide-react';

interface ClassificationResultCardProps {
  /** 推荐的文件夹 ID */
  folderId: string;
  /** 文件夹名称 */
  folderName: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 是否使用了 T1 纠正 */
  usedT1: boolean;
  /** T1 推理过程（如果使用了 T1） */
  reasoning?: string;
  /** 延迟信息 */
  latency: {
    total: number;
    t0: number;
    t1?: number;
  };
}

export function ClassificationResultCard({
  folderId: _folderId,
  folderName,
  confidence,
  usedT1,
  reasoning,
  latency,
}: ClassificationResultCardProps) {
  // 置信度颜色
  const confidenceColor =
    confidence >= 0.85
      ? 'text-green-600'
      : confidence >= 0.7
        ? 'text-yellow-600'
        : 'text-red-600';

  // 置信度百分比
  const confidencePercent = Math.round(confidence * 100);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            分类完成
          </span>
          {usedT1 && (
            <Badge variant="secondary" className="text-xs">
              深度分析
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 推荐文件夹 */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <FolderIcon className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">推荐文件夹</p>
            <p className="font-medium">{folderName}</p>
          </div>
        </div>

        {/* 置信度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">置信度</span>
            <span className={`font-semibold ${confidenceColor}`}>
              {confidencePercent}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                confidence >= 0.85
                  ? 'bg-green-600'
                  : confidence >= 0.7
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
              }`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* T1 推理过程 */}
        {usedT1 && reasoning && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              AI 推理过程
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {reasoning}
            </p>
          </div>
        )}

        {/* 延迟信息 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClockIcon className="h-3 w-3" />
          <span>
            总耗时: {latency.total}ms
            {usedT1 && latency.t1 && ` (T0: ${latency.t0}ms + T1: ${latency.t1}ms)`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
