"use client";

/**
 * Quick Add Preview Component
 *
 * Shows a compact preview of the bookmark metadata.
 * Displays title, source, and action buttons in a single line.
 * V4.2.20: 支持自动提交倒计时
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BookmarkMetadata } from "../hooks/useQuickAddState";

// Platform icons mapping
const PLATFORM_ICONS: Record<string, string> = {
  WX_OFFICIAL: "📄",
  BILIBILI: "🎬",
  XIAOHONGSHU: "📱",
  DOUYIN: "🎵",
  TAOBAO: "🛒",
  ZHIHU: "💡",
  WEIBO: "📢",
  GITHUB: "💻",
  DEFAULT: "🔗",
};

function getPlatformIcon(platform?: string): string {
  if (!platform) return PLATFORM_ICONS.DEFAULT;
  return PLATFORM_ICONS[platform] || PLATFORM_ICONS.DEFAULT;
}

/** 自动提交倒计时（毫秒） */
const AUTO_SUBMIT_DELAY = 1500;

export interface QuickAddPreviewProps {
  metadata: BookmarkMetadata;
  onSubmit: () => void;
  onOpenDrawer: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** 是否启用自动提交，默认 true */
  autoSubmit?: boolean;
  className?: string;
}

export function QuickAddPreview({
  metadata,
  onSubmit,
  onOpenDrawer,
  onCancel,
  isSubmitting = false,
  autoSubmit = true,
  className,
}: QuickAddPreviewProps) {
  const { title, sourceName, platform } = metadata;
  const [countdown, setCountdown] = useState(AUTO_SUBMIT_DELAY);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Truncate title for display
  const displayTitle = title.length > 35 ? `${title.slice(0, 35)}...` : title;

  // 自动提交倒计时
  useEffect(() => {
    if (!autoSubmit || isSubmitting || isPaused) return;

    // 启动倒计时更新（每100ms更新一次进度）
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 100));
    }, 100);

    // 设置自动提交定时器
    timerRef.current = setTimeout(() => {
      onSubmit();
    }, AUTO_SUBMIT_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoSubmit, isSubmitting, isPaused, onSubmit]);

  // 取消自动提交
  const handleCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPaused(true);
    onCancel?.();
  }, [onCancel]);

  // 暂停自动提交（用于打开抽屉时）
  const handleOpenDrawer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPaused(true);
    onOpenDrawer();
  }, [onOpenDrawer]);

  // Handle submit with Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isSubmitting) {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        onSubmit();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [onSubmit, isSubmitting, handleCancel],
  );

  // 计算进度百分比
  const progress =
    autoSubmit && !isPaused ? (countdown / AUTO_SUBMIT_DELAY) * 100 : 100;

  return (
    <div
      className={cn(
        // Base styles - 使用相对定位用于进度条
        "relative flex items-center gap-3 w-full h-11 px-4",
        "rounded-full border transition-all duration-300 overflow-hidden",

        // Preview state - green accent
        "border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-purple-50/30",
        "shadow-[0_0_20px_rgba(16,185,129,0.08)]",

        // Animation
        "animate-in slide-in-from-left-2 fade-in duration-300",

        className,
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* 自动提交进度条 */}
      {autoSubmit && !isPaused && !isSubmitting && (
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-emerald-400 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      )}

      {/* Platform icon */}
      <span className="flex-shrink-0 text-base" aria-hidden>
        {getPlatformIcon(platform)}
      </span>

      {/* Title and source */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="font-medium text-sm text-gray-900 truncate">
          {displayTitle}
        </span>
        {sourceName && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500 truncate flex-shrink-0 max-w-[100px]">
              {sourceName}
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Cancel button - 仅在自动提交倒计时中显示 */}
        {autoSubmit && !isPaused && !isSubmitting && (
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
            onClick={handleCancel}
            title="取消 (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Settings button - opens drawer */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-gray-400 hover:text-purple-600 hover:bg-purple-50"
          onClick={handleOpenDrawer}
          disabled={isSubmitting}
          title="更多选项 (Tab)"
        >
          <Settings2 className="w-4 h-4" />
        </Button>

        {/* Submit button */}
        <Button
          variant="default"
          size="sm"
          className={cn(
            "h-8 px-3 rounded-full",
            "bg-emerald-500 hover:bg-emerald-600",
            "text-white text-xs font-medium",
            "transition-all duration-200",
            isSubmitting && "opacity-70 cursor-not-allowed",
          )}
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
            onSubmit();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              保存中
            </span>
          ) : autoSubmit && !isPaused ? (
            <span className="flex items-center gap-1">
              收藏
              <span className="text-emerald-200 text-[10px]">
                {Math.ceil(countdown / 1000)}s
              </span>
            </span>
          ) : (
            "收藏"
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Error state variant
 */
export interface QuickAddErrorProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
  className?: string;
}

export function QuickAddError({
  error,
  onRetry,
  onCancel,
  className,
}: QuickAddErrorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 w-full h-11 px-4",
        "rounded-full border transition-all duration-300",
        "border-red-200 bg-red-50/50",
        "animate-in shake duration-300",
        className,
      )}
    >
      {/* Error icon */}
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />

      {/* Error message */}
      <span className="flex-1 text-sm text-red-600 truncate">{error}</span>

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
          onClick={onCancel}
        >
          取消
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onRetry}
        >
          重试
        </Button>
      </div>
    </div>
  );
}
