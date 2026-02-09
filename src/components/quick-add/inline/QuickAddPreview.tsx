"use client";

/**
 * Quick Add Preview Component
 *
 * Shows a compact preview of the bookmark metadata.
 * Displays title, source, and action buttons in a single line.
 * V4.2.20: 支持自动提交倒计时
 * V4.3.0: 链接"吸入"动效 - 方案 G
 *   - 移除旧进度条/按钮填充/倒计时数字
 *   - 新增吸入遮罩 + 粉色粒子 + 收藏图标弹跳发光
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings2, AlertCircle, X, FolderHeart } from "lucide-react";
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

/** 自动提交延迟（毫秒）- 与吸入动画 1.8s 匹配 */
const AUTO_SUBMIT_DELAY = 1800;

/** 预计算的粒子参数（增加到 8 个，覆盖整个吸入过程） */
const PARTICLES = [
  { id: 0, size: 5, flyX: 38, flyY: -8, delay: 100, color: "#f9a8d4" },
  { id: 1, size: 6, flyX: 52, flyY: 5, delay: 280, color: "#fb7185" },
  { id: 2, size: 4, flyX: 64, flyY: -12, delay: 450, color: "#f9a8d4" },
  { id: 3, size: 7, flyX: 76, flyY: 7, delay: 620, color: "#fb7185" },
  { id: 4, size: 5, flyX: 88, flyY: -4, delay: 790, color: "#f9a8d4" },
  { id: 5, size: 6, flyX: 48, flyY: 10, delay: 960, color: "#fb7185" },
  { id: 6, size: 4, flyX: 70, flyY: -9, delay: 1130, color: "#f9a8d4" },
  { id: 7, size: 5, flyX: 58, flyY: 3, delay: 1300, color: "#fb7185" },
] as const;

export interface QuickAddPreviewProps {
  metadata: BookmarkMetadata;
  onSubmit: () => void;
  onOpenDrawer: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** 是否启用自动提交，默认 true */
  autoSubmit?: boolean;
  /** 是否已发生提交错误（用于阻止自动重试） */
  hasSubmitError?: boolean;
  className?: string;
}

export function QuickAddPreview({
  metadata,
  onSubmit,
  onOpenDrawer,
  onCancel,
  isSubmitting = false,
  autoSubmit = true,
  hasSubmitError = false,
  className,
}: QuickAddPreviewProps) {
  const { title, sourceName, platform } = metadata;
  // absorbed: 吸入完成标记，用于触发图标弹跳动画
  const [isAbsorbed, setIsAbsorbed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  // Truncate title for display
  const displayTitle = title.length > 35 ? `${title.slice(0, 35)}...` : title;

  // 派生状态：是否正在吸入（无需 setState，避免 effect 内同步调用问题）
  const isAbsorbing =
    autoSubmit && !isPaused && !isSubmitting && !hasSubmitError && !isAbsorbed;

  // 启动自动提交定时器
  // V4.2.21 修复保留：当发生提交错误时，阻止自动重试以避免无限循环
  useEffect(() => {
    if (!isAbsorbing) return;

    // 吸入动画完成后自动提交
    timerRef.current = setTimeout(() => {
      setIsAbsorbed(true);
      onSubmit();
    }, AUTO_SUBMIT_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAbsorbing, onSubmit]);

  // 取消自动提交
  const handleCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPaused(true);
    onCancel?.();
  }, [onCancel]);

  // 暂停自动提交（用于打开抽屉时）
  const handleOpenDrawer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPaused(true);
    onOpenDrawer();
  }, [onOpenDrawer]);

  // Handle submit with Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isSubmitting) {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsAbsorbed(true);
        onSubmit();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [onSubmit, isSubmitting, handleCancel],
  );

  return (
    <div
      className={cn(
        // Base styles
        "relative flex items-center gap-3 w-full h-11 px-4",
        "rounded-full border transition-all duration-300 overflow-hidden",

        // Preview state - 糖果粉色体系
        "border-pink-200 bg-gradient-to-r from-pink-50/40 via-purple-50/20 to-rose-50/30",
        "shadow-[0_0_20px_rgba(244,114,182,0.08)]",

        // Animation
        "animate-in slide-in-from-left-2 fade-in duration-300",

        className,
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* ===== 吸入遮罩层 ===== */}
      {isAbsorbing && (
        <div
          className="absolute inset-0 z-[1] animate-absorb-sweep pointer-events-none"
          aria-hidden
        >
          <div className="w-full h-full bg-gradient-to-r from-pink-300/40 via-pink-400/30 to-rose-400/35 rounded-full" />
        </div>
      )}

      {/* ===== 粒子容器 ===== */}
      {isAbsorbing && (
        <div
          className="absolute inset-0 z-[2] pointer-events-none overflow-visible"
          aria-hidden
        >
          {PARTICLES.map((p) => (
            <span
              key={p.id}
              className="absorb-particle"
              style={
                {
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  boxShadow: `0 0 8px ${p.color}`,
                  right: `${60 + p.id * 5}px`,
                  top: `${30 + (p.id % 3) * 15}%`,
                  "--fly-x": `${p.flyX}px`,
                  "--fly-y": `${p.flyY}px`,
                  "--delay": `${p.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Platform icon */}
      <span className="flex-shrink-0 text-base z-[3]" aria-hidden>
        {getPlatformIcon(platform)}
      </span>

      {/* Title and source */}
      <div className="flex-1 min-w-0 flex items-center gap-2 z-[3]">
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
      <div className="flex items-center gap-1 flex-shrink-0 z-[3]">
        {/* Cancel button - 仅在吸入动画进行中显示 */}
        {isAbsorbing && (
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

        {/* 收藏按钮 = 文件夹图标 + 文字（合二为一） */}
        <button
          ref={targetRef}
          className={cn(
            "flex items-center justify-center gap-1.5 h-8 px-3 rounded-full",
            "text-xs font-medium transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2",

            // 默认：粉色文字，无背景
            "text-pink-500 hover:text-pink-600 hover:bg-pink-50",

            // 吸入中：目标脉动
            isAbsorbing && "animate-absorb-target-pulse",

            // 吸入完成：弹跳发光
            isAbsorbed && "animate-absorb-bounce animate-absorb-glow",

            // 提交中：降低透明度
            isSubmitting && "opacity-70 cursor-not-allowed",
            !isSubmitting && "hover:scale-105",
          )}
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setIsAbsorbed(true);
            onSubmit();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <FolderHeart className="w-5 h-5 animate-absorb-target-pulse" />
              保存中
            </>
          ) : (
            <>
              <FolderHeart className="w-5 h-5" />
              收藏
            </>
          )}
        </button>
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
