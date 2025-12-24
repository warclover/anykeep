/**
 * 导出书签对话框
 * 支持导出为 Markdown 或 JSON 格式
 */

"use client";

import { useState } from "react";
import { Download, FileText, FileJson } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  exportBookmarksToMarkdown,
  exportBookmarksToJSON,
  downloadFile,
  generateExportFilename,
} from "@/lib/utils/export";
import type { Bookmark } from "@/types/supabase";
import { clientLogger } from "@/lib/client-logger";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: Array<Bookmark & { folders?: { name: string } | null }>;
  selectedIds?: Set<number>;
}

type ExportFormat = "markdown" | "json";

export function ExportDialog({
  open,
  onOpenChange,
  bookmarks,
  selectedIds,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [isExporting, setIsExporting] = useState(false);

  // 确定要导出的书签
  const bookmarksToExport =
    selectedIds && selectedIds.size > 0
      ? bookmarks.filter((b) => selectedIds.has(b.id))
      : bookmarks;

  const handleExport = () => {
    if (bookmarksToExport.length === 0) {
      toast.error("没有可导出的书签");
      return;
    }

    setIsExporting(true);

    try {
      let content: string;
      let filename: string;

      if (format === "markdown") {
        content = exportBookmarksToMarkdown(bookmarksToExport, "我的书签");
        filename = generateExportFilename("md");
        downloadFile(content, filename, "text/markdown");
      } else {
        content = exportBookmarksToJSON(bookmarksToExport);
        filename = generateExportFilename("json");
        downloadFile(content, filename, "application/json");
      }

      toast.success(
        `成功导出 ${bookmarksToExport.length} 条书签为 ${format === "markdown" ? "Markdown" : "JSON"} 格式`,
      );
      onOpenChange(false);
    } catch (error) {
      clientLogger.error({ error }, "Export error");
      toast.error("导出失败，请重试");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>导出书签</DialogTitle>
          <DialogDescription>
            {selectedIds && selectedIds.size > 0
              ? `将导出选中的 ${selectedIds.size} 条书签`
              : `将导出全部 ${bookmarks.length} 条书签`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 格式选择 */}
          <div className="space-y-3">
            <Label>导出格式</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="markdown" id="markdown" />
                <Label
                  htmlFor="markdown"
                  className="flex items-center gap-2 cursor-pointer font-normal"
                >
                  <FileText className="size-4" />
                  <div>
                    <div className="font-medium">Markdown (.md)</div>
                    <div className="text-xs text-gray-500">
                      适合阅读和分享，支持笔记工具导入
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label
                  htmlFor="json"
                  className="flex items-center gap-2 cursor-pointer font-normal"
                >
                  <FileJson className="size-4" />
                  <div>
                    <div className="font-medium">JSON (.json)</div>
                    <div className="text-xs text-gray-500">
                      适合数据备份和程序处理
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 预览信息 */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                导出数量：
              </span>
              <span className="font-medium">{bookmarksToExport.length} 条</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                文件格式：
              </span>
              <span className="font-medium">
                {format === "markdown" ? "Markdown" : "JSON"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                预估大小：
              </span>
              <span className="font-medium">
                {Math.ceil(
                  (bookmarksToExport.length *
                    (format === "markdown" ? 1.5 : 0.8)) /
                    1024,
                )}{" "}
                KB
              </span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || bookmarksToExport.length === 0}
          >
            <Download className="size-4 mr-2" />
            {isExporting ? "导出中..." : "开始导出"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
