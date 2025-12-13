"use client";

/**
 * Quick Add Preview Component
 *
 * Shows a compact preview of the bookmark metadata.
 * Displays title, source, and action buttons in a single line.
 */

import { useCallback } from "react";
import { Settings2, AlertCircle } from "lucide-react";
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

export interface QuickAddPreviewProps {
  metadata: BookmarkMetadata;
  onSubmit: () => void;
  onOpenDrawer: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export function QuickAddPreview({
  metadata,
  onSubmit,
  onOpenDrawer,
  isSubmitting = false,
  className,
}: QuickAddPreviewProps) {
  const { title, sourceName, platform } = metadata;

  // Truncate title for display
  const displayTitle = title.length > 35 ? `${title.slice(0, 35)}...` : title;

  // Handle submit with Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isSubmitting) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit, isSubmitting],
  );

  return (
    <div
      className={cn(
        // Base styles
        "flex items-center gap-3 w-full h-11 px-4",
        "rounded-full border transition-all duration-300",

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
        {/* Settings button - opens drawer */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-gray-400 hover:text-purple-600 hover:bg-purple-50"
          onClick={onOpenDrawer}
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
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              保存中
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
