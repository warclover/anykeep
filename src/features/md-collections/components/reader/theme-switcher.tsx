/**
 * MD 阅读器主题切换器
 * Spec: md-reader-upgrade / REQ-1
 */

"use client";

import { useCallback, useState } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useReaderThemeContext } from "./reader-theme-provider";
import type { ThemeId, WithClassName } from "../../types/reader";

/**
 * ThemeSwitcher Props
 */
export interface ThemeSwitcherProps extends WithClassName {
  /** 按钮变体 */
  variant?: "default" | "ghost" | "outline";
  /** 按钮大小 */
  size?: "default" | "sm" | "icon" | "icon-sm";
  /** 显示标签 */
  showLabel?: boolean;
}

/**
 * 主题预览圆点组件
 */
function ThemePreviewDot({
  backgroundColor,
  foregroundColor,
  isActive,
}: {
  backgroundColor: string;
  foregroundColor: string;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "relative size-6 rounded-full border-2 transition-transform",
        isActive
          ? "scale-110 border-primary"
          : "border-transparent hover:scale-105",
      )}
      style={{ backgroundColor }}
    >
      {/* 内部小圆点显示前景色 */}
      <div
        className="absolute inset-1/4 rounded-full"
        style={{ backgroundColor: foregroundColor }}
      />
      {/* 选中标记 */}
      {isActive && (
        <div className="absolute -right-0.5 -top-0.5 rounded-full bg-primary p-0.5">
          <Check className="size-2 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

/**
 * 主题选项按钮
 */
function ThemeOption({
  themeId: _themeId,
  themeName,
  backgroundColor,
  foregroundColor,
  isActive,
  onClick,
}: {
  themeId: ThemeId;
  themeName: string;
  backgroundColor: string;
  foregroundColor: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
        "hover:bg-accent focus:bg-accent focus:outline-none",
        isActive && "bg-accent/50",
      )}
      aria-pressed={isActive}
      aria-label={`切换到${themeName}主题`}
    >
      <ThemePreviewDot
        backgroundColor={backgroundColor}
        foregroundColor={foregroundColor}
        isActive={isActive}
      />
      <span className="flex-1 text-sm font-medium">{themeName}</span>
      {isActive && <Check className="size-4 text-primary" />}
    </button>
  );
}

/**
 * 阅读器主题切换器
 *
 * 功能：
 * - Popover 展示 4 种主题选项
 * - 显示颜色预览
 * - 点击立即应用
 * - 支持键盘导航
 *
 * @example
 * ```tsx
 * <ReaderThemeProvider>
 *   <ThemeSwitcher />
 * </ReaderThemeProvider>
 * ```
 */
export function ThemeSwitcher({
  className,
  variant = "ghost",
  size = "icon",
  showLabel = false,
}: ThemeSwitcherProps) {
  const { theme, setTheme, themes } = useReaderThemeContext();
  const [open, setOpen] = useState(false);

  const handleThemeSelect = useCallback(
    (themeId: ThemeId) => {
      setTheme(themeId);
      setOpen(false);
    },
    [setTheme],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-2", className)}
          aria-label="切换阅读主题"
        >
          <Palette className="size-4" />
          {showLabel && <span>主题</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end" sideOffset={8}>
        <div className="space-y-1">
          <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
            选择阅读主题
          </p>
          {themes.map((t) => (
            <ThemeOption
              key={t.id}
              themeId={t.id}
              themeName={t.name}
              backgroundColor={t.colors.background}
              foregroundColor={t.colors.foreground}
              isActive={theme.id === t.id}
              onClick={() => handleThemeSelect(t.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ThemeSwitcher;
