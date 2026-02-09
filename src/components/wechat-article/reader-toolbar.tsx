/**
 * 微信文章阅读器工具栏
 *
 * @module wechat-article
 * @description 提供字体调节、目录导航等功能
 *
 * Phase 4 升级：UX 优化 - 阅读器增强
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings2,
  List,
  Minus,
  Plus,
  Sun,
  Moon,
  BookOpen,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReaderSettings, ReaderTheme } from "./hooks/use-reader-settings";
import type { TocItem } from "./hooks/use-toc";

// =============================================================================
// 类型定义
// =============================================================================

export interface ReaderToolbarProps {
  /** 阅读设置 */
  settings: ReaderSettings;
  /** 更新字体大小 */
  onFontSizeChange: (size: number) => void;
  /** 更新主题 */
  onThemeChange: (theme: ReaderTheme) => void;
  /** 目录项 */
  tocItems?: TocItem[];
  /** 点击目录项 */
  onTocClick?: (id: string) => void;
  /** 阅读进度 (0-100) */
  progress?: number;
  /** 复制全文 */
  onCopyText?: () => void;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 子组件
// =============================================================================

/**
 * 字体设置弹窗
 */
function FontSettingsPopover({
  settings,
  onFontSizeChange,
  onThemeChange,
}: {
  settings: ReaderSettings;
  onFontSizeChange: (size: number) => void;
  onThemeChange: (theme: ReaderTheme) => void;
}) {
  const themes: { value: ReaderTheme; label: string; icon: typeof Sun }[] = [
    { value: "default", label: "默认", icon: Sun },
    { value: "sepia", label: "护眼", icon: BookOpen },
    { value: "dark", label: "夜间", icon: Moon },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          {/* 字体大小 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">字体大小</span>
              <span className="text-sm text-muted-foreground">
                {settings.fontSize}px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onFontSizeChange(settings.fontSize - 2)}
                disabled={settings.fontSize <= 12}
              >
                <Minus className="size-3" />
              </Button>
              <Slider
                value={[settings.fontSize]}
                min={12}
                max={24}
                step={2}
                className="flex-1"
                onValueChange={([value]) => onFontSizeChange(value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => onFontSizeChange(settings.fontSize + 2)}
                disabled={settings.fontSize >= 24}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          {/* 主题切换 */}
          <div className="space-y-2">
            <span className="text-sm font-medium">阅读主题</span>
            <div className="flex gap-2">
              {themes.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={settings.theme === value ? "secondary" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => onThemeChange(value)}
                >
                  <Icon className="size-3 mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 目录弹窗
 */
function TocPopover({
  items,
  onItemClick,
}: {
  items: TocItem[];
  onItemClick: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <List className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-2">
          <span className="text-sm font-medium">文章目录</span>
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-md",
                    "hover:bg-muted transition-colors",
                    "line-clamp-1",
                  )}
                  style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                  onClick={() => onItemClick(item.id)}
                >
                  {item.text}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// 主组件
// =============================================================================

/**
 * 阅读器工具栏
 *
 * 功能：
 * - 字体大小调节
 * - 阅读主题切换
 * - 目录导航
 * - 阅读进度显示
 * - 复制全文
 */
export function ReaderToolbar({
  settings,
  onFontSizeChange,
  onThemeChange,
  tocItems = [],
  onTocClick,
  progress = 0,
  onCopyText,
  className,
}: ReaderToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyText?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* 阅读进度 */}
      {progress > 0 && (
        <div className="flex items-center gap-1 mr-2">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8">{progress}%</span>
        </div>
      )}

      {/* 目录 */}
      {tocItems.length > 0 && onTocClick && (
        <TocPopover items={tocItems} onItemClick={onTocClick} />
      )}

      {/* 字体设置 */}
      <FontSettingsPopover
        settings={settings}
        onFontSizeChange={onFontSizeChange}
        onThemeChange={onThemeChange}
      />

      {/* 复制全文 */}
      {onCopyText && (
        <Button variant="ghost" size="icon" onClick={handleCopy}>
          {copied ? (
            <Check className="size-4 text-green-500" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      )}
    </div>
  );
}

export default ReaderToolbar;
