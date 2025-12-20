/**
 * 导出预览组件
 * 显示导出信息摘要和预览
 */

"use client";

import { Eye, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/export/utils/preview.utils";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";
import type { ExportFormat, ExportPreviewData } from "@/lib/export/types";

interface ExportPreviewProps {
  /** 预览数据 */
  data: ExportPreviewData;
  /** 导出格式 */
  format: ExportFormat;
  /** 查看示例回调 */
  onViewSample?: () => void;
  /** 是否显示查看示例按钮 */
  showViewSample?: boolean;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 样式类名 */
  className?: string;
}

export function ExportPreview({
  data,
  format,
  onViewSample,
  showViewSample = true,
  isLoading = false,
  className,
}: ExportPreviewProps) {
  const { totalCount, estimatedSize } = data;
  const formatConfig = EXPORT_FORMAT_CONFIG[format];

  return (
    <div className={cn("space-y-3", className)}>
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileDown className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">导出预览</span>
        </div>
        {showViewSample && onViewSample && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewSample}
            disabled={isLoading || totalCount === 0}
            className="h-7 text-xs"
          >
            <Eye className="size-3 mr-1" />
            查看示例
          </Button>
        )}
      </div>

      {/* 预览信息卡片 */}
      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              计算中...
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">符合条件的书签</span>
              <span className="font-medium">
                {totalCount.toLocaleString()} 条
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">导出格式</span>
              <span className="font-medium">
                {formatConfig?.label || format}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">预估文件大小</span>
              <span className="font-medium">
                ~{formatFileSize(estimatedSize)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 提示信息 */}
      {totalCount === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground text-center py-2">
          没有符合条件的数据可导出
        </p>
      )}

      {totalCount > 5000 && !isLoading && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          数据量较大，导出可能需要一些时间
        </p>
      )}
    </div>
  );
}
