/**
 * 颜色主题选择器
 * 设置页面使用，支持三种品牌色主题选择
 *
 * V4.2.25: 新增外观设置
 *
 * @version 1.0.0
 * @since 2025-12-17
 */

"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useColorTheme, COLOR_THEME_INFO } from "@/hooks/use-color-theme";
import type { ColorTheme } from "@/types/user-settings";

const THEMES: ColorTheme[] = ["blue", "purple", "orange"];

interface ColorThemeSelectorProps {
  /** 自定义类名 */
  className?: string;
}

export function ColorThemeSelector({ className }: ColorThemeSelectorProps) {
  const { colorTheme, setColorTheme, isLoaded } = useColorTheme();

  // 加载完成前显示骨架屏
  if (!isLoaded) {
    return (
      <div className={cn("grid grid-cols-3 gap-3", className)}>
        {THEMES.map((id) => (
          <div
            key={id}
            className="flex flex-col items-center p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 animate-pulse"
          >
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 mb-3" />
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="w-20 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {THEMES.map((themeId) => {
        const info = COLOR_THEME_INFO[themeId];
        const isSelected = colorTheme === themeId;

        return (
          <button
            key={themeId}
            type="button"
            onClick={() => setColorTheme(themeId)}
            className={cn(
              "relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50",
            )}
          >
            {/* 选中指示 */}
            {isSelected && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              </div>
            )}

            {/* 颜色预览圆 */}
            <div
              className={cn(
                "w-12 h-12 rounded-full bg-gradient-to-br mb-3 shadow-md",
                info.gradient,
              )}
            />

            {/* 主题名称 */}
            <span
              className={cn(
                "font-medium text-sm",
                isSelected
                  ? "text-primary"
                  : "text-gray-900 dark:text-gray-100",
              )}
            >
              {info.name}
            </span>

            {/* 描述 */}
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center leading-tight">
              {info.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 紧凑版主题选择器（用于移动端或空间有限场景）
 */
export function ColorThemeSelectorCompact({
  className,
}: ColorThemeSelectorProps) {
  const { colorTheme, setColorTheme, isLoaded } = useColorTheme();

  if (!isLoaded) {
    return (
      <div className={cn("flex gap-2", className)}>
        {THEMES.map((id) => (
          <div
            key={id}
            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {THEMES.map((themeId) => {
        const info = COLOR_THEME_INFO[themeId];
        const isSelected = colorTheme === themeId;

        return (
          <button
            key={themeId}
            type="button"
            onClick={() => setColorTheme(themeId)}
            title={info.name}
            className={cn(
              "w-8 h-8 rounded-full bg-gradient-to-br transition-all duration-200",
              info.gradient,
              isSelected
                ? "ring-2 ring-offset-2 ring-primary ring-offset-background"
                : "hover:scale-110",
            )}
          >
            {isSelected && <Check className="size-4 text-white mx-auto" />}
          </button>
        );
      })}
    </div>
  );
}
