/**
 * 样式选择器组件
 *
 * @module wechat-article
 * @description 选择文章样式保留级别
 *
 * 样式选项升级：用户选择 UI
 */

"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Palette, Check } from "lucide-react";
import type { StylePreserveLevel } from "@/lib/wechat-article/wechat-article.config";

// =============================================================================
// 类型定义
// =============================================================================

export interface StyleSelectorProps {
  /** 当前样式级别 */
  value: StylePreserveLevel;
  /** 样式级别变更回调 */
  onChange: (level: StylePreserveLevel) => void;
  /** "记住我的选择"状态 */
  rememberChoice?: boolean;
  /** "记住我的选择"变更回调 */
  onRememberChoiceChange?: (remember: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 常量配置
// =============================================================================

const STYLE_OPTIONS: Array<{
  value: StylePreserveLevel;
  label: string;
  description: string;
}> = [
  {
    value: "full-snapshot",
    label: "完整快照",
    description: "保留完整排版样式（背景、边框、布局等）",
  },
  {
    value: "text-only",
    label: "仅文字效果",
    description: "仅保留文字样式（颜色、字号、对齐等）",
  },
];

// =============================================================================
// 组件实现
// =============================================================================

/**
 * 样式选择器
 *
 * 功能：
 * - 选择样式保留级别
 * - 显示当前级别描述
 * - 支持"记住我的选择"开关
 */
export function StyleSelector({
  value,
  onChange,
  rememberChoice,
  onRememberChoiceChange,
  disabled = false,
  className,
}: StyleSelectorProps) {
  const currentOption = STYLE_OPTIONS.find((opt) => opt.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn("h-8 gap-1", className)}
        >
          <Palette className="size-4" />
          <span className="hidden sm:inline">
            {currentOption?.label || "样式"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>样式保留级别</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as StylePreserveLevel)}
        >
          {STYLE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="flex flex-col items-start py-2"
            >
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {onRememberChoiceChange !== undefined && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-2">
              <label
                htmlFor="remember-choice"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                记住我的选择
              </label>
              <Switch
                id="remember-choice"
                checked={rememberChoice}
                onCheckedChange={onRememberChoiceChange}
              />
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 紧凑样式选择器（用于首次抓取对话框）
 */
export function StyleSelectorCompact({
  value,
  onChange,
  className,
}: {
  value: StylePreserveLevel;
  onChange: (level: StylePreserveLevel) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      {STYLE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(option.value)}
          className="flex-1"
        >
          {value === option.value && <Check className="size-3 mr-1" />}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export default StyleSelector;
