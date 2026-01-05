/**
 * TTS 播放按钮组件
 *
 * 支持三种变体：
 * - icon: 仅图标（用于紧凑布局）
 * - button: 图标+文字按钮
 * - menu-item: 下拉菜单项
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { useState, useCallback } from "react";
import {
  Volume2,
  Loader2,
  Pause,
  ChevronDown,
  Zap,
  FileText,
  List,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTTSPlayerContext } from "./tts-player-context";
import type { TTSContentType } from "@/lib/tts";
import { TTS } from "@/lib/constants/messages";

// ============================================
// 类型定义
// ============================================

/**
 * 组件变体
 */
export type TTSPlayerButtonVariant = "icon" | "button" | "menu-item";

/**
 * 组件尺寸
 */
export type TTSPlayerButtonSize = "sm" | "md";

/**
 * 组件属性
 */
export interface TTSPlayerButtonProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 组件变体 */
  variant?: TTSPlayerButtonVariant;
  /** 组件尺寸 */
  size?: TTSPlayerButtonSize;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外样式类名 */
  className?: string;
  /** 默认内容类型 */
  defaultContentType?: TTSContentType;
}

// ============================================
// 内容类型配置
// ============================================

const CONTENT_TYPE_OPTIONS: Array<{
  type: TTSContentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    type: "tldr",
    label: TTS.CONTENT_TYPES.ONE_LINER.LABEL,
    icon: Zap,
    description: TTS.CONTENT_TYPES.ONE_LINER.DESCRIPTION,
  },
  {
    type: "summary",
    label: TTS.CONTENT_TYPES.SUMMARY.LABEL,
    icon: FileText,
    description: TTS.CONTENT_TYPES.SUMMARY.DESCRIPTION,
  },
  {
    type: "keypoints",
    label: TTS.CONTENT_TYPES.KEY_POINTS.LABEL,
    icon: List,
    description: TTS.CONTENT_TYPES.KEY_POINTS.DESCRIPTION,
  },
  {
    type: "all",
    label: TTS.CONTENT_TYPES.FULL.LABEL,
    icon: BookOpen,
    description: TTS.CONTENT_TYPES.FULL.DESCRIPTION,
  },
];

// ============================================
// 组件实现
// ============================================

/**
 * TTS 播放按钮组件
 */
export function TTSPlayerButton({
  bookmarkId,
  variant = "button",
  size = "sm",
  disabled = false,
  className,
  defaultContentType = "summary",
}: TTSPlayerButtonProps) {
  // V4.2.27: 使用全局 Context，避免组件卸载时中止请求
  const { state, controls } = useTTSPlayerContext();
  const [selectedType, setSelectedType] =
    useState<TTSContentType>(defaultContentType);

  // 检查是否正在播放当前书签
  const isCurrentBookmark = state.currentBookmarkId === bookmarkId;
  const isPlaying = isCurrentBookmark && state.state === "playing";
  const isLoading = isCurrentBookmark && state.state === "loading";
  const isPaused = isCurrentBookmark && state.state === "paused";

  // 处理播放/暂停
  const handlePlayPause = useCallback(
    async (contentType?: TTSContentType) => {
      const type = contentType || selectedType;

      if (isPlaying) {
        controls.pause();
      } else if (isPaused) {
        controls.resume();
      } else {
        await controls.play({
          bookmarkId,
          contentType: type,
        });
      }
    },
    [bookmarkId, controls, isPlaying, isPaused, selectedType],
  );

  // 处理内容类型选择
  const handleSelectType = useCallback(
    async (type: TTSContentType) => {
      setSelectedType(type);
      // 直接播放选中的类型
      await controls.play({
        bookmarkId,
        contentType: type,
      });
    },
    [bookmarkId, controls],
  );

  // 图标渲染
  const renderIcon = () => {
    if (isLoading) {
      return <Loader2 className="animate-spin" />;
    }
    if (isPlaying) {
      return <Pause />;
    }
    if (isPaused) {
      return <Volume2 />;
    }
    return <Volume2 />;
  };

  // 尺寸配置
  const sizeClasses = {
    sm: {
      icon: "size-3.5",
      button: "h-8 px-2",
      text: "text-sm",
    },
    md: {
      icon: "size-4",
      button: "h-9 px-3",
      text: "text-base",
    },
  };

  const currentSize = sizeClasses[size];

  // ============================================
  // Icon 变体
  // ============================================
  if (variant === "icon") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            className={cn("relative", isPlaying && "text-primary", className)}
          >
            <span className={currentSize.icon}>{renderIcon()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>选择朗读内容</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CONTENT_TYPE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.type}
              onClick={() => handleSelectType(option.type)}
              className="flex items-center gap-2"
            >
              <option.icon className="size-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ============================================
  // Menu Item 变体
  // ============================================
  if (variant === "menu-item") {
    return (
      <>
        {CONTENT_TYPE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.type}
            onClick={() => handleSelectType(option.type)}
            disabled={disabled}
            className="flex items-center gap-2"
          >
            {isLoading && selectedType === option.type ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <option.icon className="size-4" />
            )}
            <span>朗读{option.label}</span>
          </DropdownMenuItem>
        ))}
      </>
    );
  }

  // ============================================
  // Button 变体（默认）
  // ============================================
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* 主按钮 */}
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled || isLoading}
        onClick={() => handlePlayPause()}
        className={cn(
          currentSize.button,
          "rounded-r-none",
          isPlaying && "text-primary",
        )}
      >
        <span className={currentSize.icon}>{renderIcon()}</span>
        <span className="ml-1.5 hidden sm:inline">
          {isLoading
            ? "加载中..."
            : isPlaying
              ? "暂停"
              : isPaused
                ? "继续"
                : "朗读"}
        </span>
      </Button>

      {/* 下拉选择 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-8 w-6 px-0 rounded-l-none border-l",
              isPlaying && "text-primary",
            )}
          >
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>选择朗读内容</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CONTENT_TYPE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.type}
              onClick={() => handleSelectType(option.type)}
              className={cn(
                "flex items-center gap-2",
                selectedType === option.type && "bg-accent",
              )}
            >
              <option.icon className="size-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
