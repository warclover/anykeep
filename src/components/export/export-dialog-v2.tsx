/**
 * ExportDialogV2 - 统一导出对话框
 * 支持两种模式：full（完整筛选模式）和 selected（选中模式）
 * 可被导出页面、批量操作、首页等多处复用
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExportFormatSelector } from "./export-format-selector";
import { ExportFieldSelector } from "./export-field-selector";
import { ExportPreview } from "./export-preview";
import { ExportPreviewModal } from "./export-preview-modal";
import { ExportProgressBar } from "./export-progress";
import {
  exportService,
  downloadFile,
  shouldShowProgress,
} from "@/lib/export/services";
import {
  estimateFileSize,
  generatePreviewContent,
} from "@/lib/export/utils/preview.utils";
import {
  EXPORT_FORMAT_CONFIG,
  DEFAULT_CSV_FIELDS,
  EXPORT_DIALOG_TEXT,
} from "@/lib/export/constants";
import { exportAnalytics } from "@/lib/export/analytics";
import type {
  ExportDialogV2Props,
  ExportFormat,
  ExportProgress,
  ExportPreviewData,
  ExportSource,
} from "@/lib/export/types";

/** 对话框步骤 */
type DialogStep = "config" | "progress" | "success" | "error";

export function ExportDialogV2({
  open,
  onOpenChange,
  mode,
  bookmarks = [],
  initialFilter: _initialFilter,
  onSuccess,
  onError,
}: ExportDialogV2Props) {
  // 状态
  const [step, setStep] = useState<DialogStep>("config");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [csvFields, setCsvFields] = useState<string[]>([...DEFAULT_CSV_FIELDS]);
  const [progress, setProgress] = useState<ExportProgress>({
    status: "idle",
    current: 0,
    total: 0,
    percentage: 0,
  });
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [exportResult, setExportResult] = useState<{
    filename: string;
    count: number;
    size: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // 取消控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  // 重置状态
  const resetState = useCallback(() => {
    setStep("config");
    setProgress({
      status: "idle",
      current: 0,
      total: 0,
      percentage: 0,
    });
    setExportResult(null);
    setErrorMessage("");
  }, []);

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      resetState();
      // 埋点：对话框打开
      const source: ExportSource = mode === "full" ? "page" : "batch";
      exportAnalytics.dialogOpened(source);
    }
  }, [open, mode, resetState]);

  // 计算预览数据
  const previewData: ExportPreviewData = {
    totalCount: bookmarks.length,
    estimatedSize: estimateFileSize(bookmarks, format),
    previewItems: bookmarks.slice(0, 3),
  };

  // 格式变更处理
  const handleFormatChange = (newFormat: ExportFormat) => {
    setFormat(newFormat);
    exportAnalytics.formatSelected(newFormat);
  };

  // 查看预览
  const handleViewPreview = () => {
    const content = generatePreviewContent(bookmarks, format, 3);
    setPreviewContent(content);
    setPreviewModalOpen(true);
    exportAnalytics.previewViewed(format, bookmarks.length);
  };

  // 取消导出
  const handleCancel = () => {
    abortControllerRef.current?.abort();
    exportService.cancel();
    setStep("config");
    setProgress((prev) => ({ ...prev, status: "cancelled" }));
    exportAnalytics.cancelled({
      format,
      count: bookmarks.length,
    });
  };

  // 执行导出
  const handleExport = async () => {
    if (bookmarks.length === 0) {
      toast.error("没有可导出的数据");
      return;
    }

    const startTime = Date.now();

    // 埋点：开始导出
    exportAnalytics.started({
      source: mode === "full" ? "page" : "batch",
      format,
      count: bookmarks.length,
    });

    // 创建取消控制器
    abortControllerRef.current = new AbortController();

    // 是否显示进度条
    const showProgress = shouldShowProgress(bookmarks.length);

    if (showProgress) {
      setStep("progress");
    }

    try {
      const result = await exportService.export(
        bookmarks,
        {
          format,
          options: {
            csv: format === "csv" ? { fields: csvFields } : undefined,
          },
        },
        {
          signal: abortControllerRef.current.signal,
          onProgress: (p) => {
            setProgress(p);
          },
        },
      );

      if (result.success) {
        // 触发下载
        const mimeType =
          EXPORT_FORMAT_CONFIG[format]?.mimeType || "application/octet-stream";
        downloadFile(result.content, result.filename, mimeType);

        // 更新状态
        setExportResult({
          filename: result.filename,
          count: result.count,
          size: result.size || 0,
        });
        setStep("success");

        // 埋点：导出成功
        const duration = Date.now() - startTime;
        exportAnalytics.completed({
          source: mode === "full" ? "page" : "batch",
          format,
          count: result.count,
          duration,
          fileSize: result.size,
        });

        // 回调
        onSuccess?.(result);
      } else {
        throw new Error(result.error || "导出失败");
      }
    } catch (error) {
      console.error("[ExportDialogV2] Export failed:", error);

      // 检查是否是取消
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "导出失败，请重试";
      setErrorMessage(message);
      setStep("error");

      // 埋点：导出失败
      exportAnalytics.failed({
        format,
        count: bookmarks.length,
        errorCode: "UNKNOWN",
      });

      onError?.("UNKNOWN", message);
    } finally {
      abortControllerRef.current = null;
    }
  };

  // 关闭对话框
  const handleClose = () => {
    if (step === "progress") {
      handleCancel();
    }
    onOpenChange(false);
  };

  // 再次导出
  const handleExportAgain = () => {
    resetState();
  };

  // 渲染配置步骤
  const renderConfigStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>{EXPORT_DIALOG_TEXT.confirmTitle}</DialogTitle>
        <DialogDescription>
          {mode === "selected"
            ? `导出已选中的 ${bookmarks.length} 条书签`
            : `导出 ${bookmarks.length} 条书签`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* 格式选择 */}
        <ExportFormatSelector value={format} onChange={handleFormatChange} />

        {/* CSV 字段选择 */}
        {format === "csv" && (
          <ExportFieldSelector value={csvFields} onChange={setCsvFields} />
        )}

        {/* 导出预览 */}
        <ExportPreview
          data={previewData}
          format={format}
          onViewSample={handleViewPreview}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose}>
          {EXPORT_DIALOG_TEXT.buttons.cancel}
        </Button>
        <Button onClick={handleExport} disabled={bookmarks.length === 0}>
          <Download className="size-4 mr-2" />
          {EXPORT_DIALOG_TEXT.buttons.confirm}
        </Button>
      </div>
    </>
  );

  // 渲染进度步骤
  const renderProgressStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>{EXPORT_DIALOG_TEXT.progressTitle}</DialogTitle>
      </DialogHeader>

      <div className="py-6">
        <ExportProgressBar progress={progress} onCancel={handleCancel} />
      </div>
    </>
  );

  // 渲染成功步骤
  const renderSuccessStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="size-5" />
          {EXPORT_DIALOG_TEXT.successTitle}
        </DialogTitle>
      </DialogHeader>

      <div className="py-6 space-y-4">
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-4 text-sm space-y-1">
          <p>
            {EXPORT_DIALOG_TEXT.success.downloaded}{" "}
            <span className="font-medium">{exportResult?.filename}</span>
          </p>
          <p>
            {EXPORT_DIALOG_TEXT.success.totalExported}{" "}
            <span className="font-medium">{exportResult?.count}</span>{" "}
            {EXPORT_DIALOG_TEXT.success.items}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleExportAgain}>
          {EXPORT_DIALOG_TEXT.buttons.exportAgain}
        </Button>
        <Button onClick={handleClose}>
          {EXPORT_DIALOG_TEXT.buttons.close}
        </Button>
      </div>
    </>
  );

  // 渲染错误步骤
  const renderErrorStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" />
          导出失败
        </DialogTitle>
      </DialogHeader>

      <div className="py-6">
        <div className="rounded-lg bg-destructive/10 p-4 text-sm">
          <p className="text-destructive">{errorMessage}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose}>
          {EXPORT_DIALOG_TEXT.buttons.cancel}
        </Button>
        <Button onClick={handleExportAgain}>重试</Button>
      </div>
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          {step === "config" && renderConfigStep()}
          {step === "progress" && renderProgressStep()}
          {step === "success" && renderSuccessStep()}
          {step === "error" && renderErrorStep()}
        </DialogContent>
      </Dialog>

      {/* 预览弹窗 */}
      <ExportPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        content={previewContent}
        format={format}
      />
    </>
  );
}
