/**
 * 导出预览弹窗
 * 显示导出数据的预览内容
 */

"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";
import type { ExportFormat } from "@/lib/export/types";

interface ExportPreviewModalProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 预览内容 */
  content: string;
  /** 导出格式 */
  format: ExportFormat;
  /** 预览条数 */
  previewCount?: number;
}

export function ExportPreviewModal({
  open,
  onOpenChange,
  content,
  format,
  previewCount = 3,
}: ExportPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const formatConfig = EXPORT_FORMAT_CONFIG[format];

  // 复制内容
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>导出预览</DialogTitle>
          <DialogDescription>
            {formatConfig?.label || format} 格式预览（前 {previewCount} 条）
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {/* 复制按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="absolute right-2 top-2 z-10 h-7"
          >
            {copied ? (
              <>
                <Check className="size-3 mr-1" />
                已复制
              </>
            ) : (
              <>
                <Copy className="size-3 mr-1" />
                复制
              </>
            )}
          </Button>

          {/* 预览内容 */}
          <ScrollArea className="h-[400px] rounded-lg border bg-muted/30">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
              {content || "暂无预览内容"}
            </pre>
          </ScrollArea>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
