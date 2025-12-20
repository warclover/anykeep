/**
 * CSV 字段选择器
 * 支持自定义导出字段
 */

"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CSV_FIELD_CONFIG,
  DEFAULT_CSV_FIELDS,
  OPTIONAL_CSV_FIELDS,
} from "@/lib/export/constants";

interface ExportFieldSelectorProps {
  /** 选中的字段列表 */
  value: string[];
  /** 字段变更回调 */
  onChange: (fields: string[]) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否默认展开 */
  defaultOpen?: boolean;
  /** 样式类名 */
  className?: string;
}

export function ExportFieldSelector({
  value,
  onChange,
  disabled = false,
  defaultOpen = false,
  className,
}: ExportFieldSelectorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // 所有可选字段
  const allFields = [...DEFAULT_CSV_FIELDS, ...OPTIONAL_CSV_FIELDS];

  // 切换字段选中状态
  const toggleField = (field: string) => {
    if (disabled) return;

    if (value.includes(field)) {
      // 至少保留一个字段
      if (value.length > 1) {
        onChange(value.filter((f) => f !== field));
      }
    } else {
      onChange([...value, field]);
    }
  };

  // 全选
  const selectAll = () => {
    if (disabled) return;
    onChange([...allFields]);
  };

  // 重置为默认
  const resetToDefault = () => {
    if (disabled) return;
    onChange([...DEFAULT_CSV_FIELDS]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-auto py-2"
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="size-4" />
              <span className="font-medium">CSV 高级选项</span>
            </div>
            <span className="text-xs text-muted-foreground">
              已选 {value.length}/{allFields.length} 个字段
            </span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-3">
          <div className="rounded-lg border p-4 space-y-4">
            {/* 快捷操作 */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">导出字段</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  disabled={disabled || value.length === allFields.length}
                  className="h-7 text-xs"
                >
                  全选
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToDefault}
                  disabled={disabled}
                  className="h-7 text-xs"
                >
                  重置
                </Button>
              </div>
            </div>

            {/* 默认字段 */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">基础字段</p>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_CSV_FIELDS.map((field) => {
                  const config = CSV_FIELD_CONFIG[field];
                  return (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={`field-${field}`}
                        checked={value.includes(field)}
                        onCheckedChange={() => toggleField(field)}
                        disabled={disabled}
                      />
                      <Label
                        htmlFor={`field-${field}`}
                        className={cn(
                          "text-sm cursor-pointer",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {config?.label || field}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 可选字段 */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">可选字段</p>
              <div className="grid grid-cols-2 gap-2">
                {OPTIONAL_CSV_FIELDS.map((field) => {
                  const config = CSV_FIELD_CONFIG[field];
                  return (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={`field-${field}`}
                        checked={value.includes(field)}
                        onCheckedChange={() => toggleField(field)}
                        disabled={disabled}
                      />
                      <Label
                        htmlFor={`field-${field}`}
                        className={cn(
                          "text-sm cursor-pointer",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {config?.label || field}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
