/**
 * 导出格式选择器
 * 支持 5 种导出格式选择
 */

"use client";

import {
  FileSpreadsheet,
  FileText,
  FileCode,
  FileArchive,
  FileJson,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";
import type { ExportFormat } from "@/lib/export/types";

interface ExportFormatSelectorProps {
  /** 当前选中的格式 */
  value: ExportFormat;
  /** 格式变更回调 */
  onChange: (format: ExportFormat) => void;
  /** 可用格式列表（用于权限控制） */
  availableFormats?: ExportFormat[];
  /** 禁用的格式列表 */
  disabledFormats?: ExportFormat[];
  /** 是否显示描述 */
  showDescription?: boolean;
  /** 样式类名 */
  className?: string;
}

/** 格式图标映射 */
const FORMAT_ICONS: Record<ExportFormat, React.ElementType> = {
  csv: FileSpreadsheet,
  markdown: FileText,
  obsidian: FileCode,
  "obsidian-zip": FileArchive,
  json: FileJson,
  html: FileCode2,
};

/** 所有格式（按显示顺序） */
const ALL_FORMATS: ExportFormat[] = [
  "csv",
  "markdown",
  "obsidian",
  "obsidian-zip",
  "json",
];

export function ExportFormatSelector({
  value,
  onChange,
  availableFormats = ALL_FORMATS,
  disabledFormats = [],
  showDescription = true,
  className,
}: ExportFormatSelectorProps) {
  const formatsToShow = ALL_FORMATS.filter((f) => availableFormats.includes(f));

  return (
    <div className={cn("space-y-3", className)}>
      <Label className="text-sm font-medium">导出格式</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ExportFormat)}
        className="space-y-2"
      >
        {formatsToShow.map((format) => {
          const config = EXPORT_FORMAT_CONFIG[format];
          const Icon = FORMAT_ICONS[format];
          const isDisabled = disabledFormats.includes(format);
          const isPremium = format === "obsidian" || format === "obsidian-zip";

          return (
            <div
              key={format}
              className={cn(
                "flex items-center space-x-3 rounded-lg border p-3 transition-colors",
                value === format
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <RadioGroupItem
                value={format}
                id={format}
                disabled={isDisabled}
                className="shrink-0"
              />
              <Label
                htmlFor={format}
                className={cn(
                  "flex items-center gap-3 cursor-pointer flex-1",
                  isDisabled && "cursor-not-allowed",
                )}
              >
                <Icon className="size-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{config.label}</span>
                    {isPremium && (
                      <Badge variant="secondary" className="text-xs">
                        高级
                      </Badge>
                    )}
                  </div>
                  {showDescription && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {config.description}
                    </p>
                  )}
                </div>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
