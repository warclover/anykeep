/**
 * 综述导出对话框组件
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState, useCallback } from "react";
import { Download, FileText, FileCode, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { EXPORT_FORMATS, exportSynthesis } from "@/lib/synthesis/export";
import type { SynthesisReport, SynthesisExportFormat } from "@/lib/synthesis";

interface SynthesisExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: SynthesisReport;
}

const FORMAT_ICONS: Record<SynthesisExportFormat, React.ReactNode> = {
  markdown: <FileText className="h-5 w-5" />,
  obsidian: <FileCode className="h-5 w-5" />,
  json: <FileCode className="h-5 w-5" />,
  html: <Globe className="h-5 w-5" />,
};

export function SynthesisExportDialog({
  open,
  onOpenChange,
  report,
}: SynthesisExportDialogProps) {
  const [format, setFormat] = useState<SynthesisExportFormat>("markdown");
  const [includeSources, setIncludeSources] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const { content, filename, mimeType } = exportSynthesis(report, format, {
        includeSources,
        includeMetadata,
      });

      // 创建下载
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  }, [report, format, includeSources, includeMetadata, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            导出综述
          </DialogTitle>
          <DialogDescription>
            选择导出格式和选项，将综述保存到本地
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 格式选择 */}
          <div className="space-y-3">
            <Label>导出格式</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as SynthesisExportFormat)}
              className="grid grid-cols-2 gap-3"
            >
              {EXPORT_FORMATS.map((f) => (
                <div key={f.id}>
                  <RadioGroupItem
                    value={f.id}
                    id={f.id}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={f.id}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all",
                      "hover:bg-muted/50",
                      format === f.id
                        ? "border-primary bg-primary/5"
                        : "border-muted",
                    )}
                  >
                    <div className="mb-2">{FORMAT_ICONS[f.id]}</div>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-xs text-muted-foreground mt-1 text-center">
                      {f.description}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 选项 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-sources">包含来源信息</Label>
                <p className="text-xs text-muted-foreground">
                  在输出中显示每个观点的来源书签
                </p>
              </div>
              <Switch
                id="include-sources"
                checked={includeSources}
                onCheckedChange={setIncludeSources}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-metadata">包含元数据</Label>
                <p className="text-xs text-muted-foreground">
                  包含生成时间、来源数量等信息
                </p>
              </div>
              <Switch
                id="include-metadata"
                checked={includeMetadata}
                onCheckedChange={setIncludeMetadata}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                导出
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
