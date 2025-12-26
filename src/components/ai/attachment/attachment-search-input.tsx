/**
 * 附件搜索输入框组件
 *
 * 用于搜索全库收藏
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ATTACHMENT_TEXT } from "./types";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentSearchInputProps {
  /** 搜索值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 占位符 */
  placeholder?: string;
  /** 是否正在搜索 */
  isSearching?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 组件实现
// =============================================================================

export function AttachmentSearchInput({
  value,
  onChange,
  placeholder = ATTACHMENT_TEXT.SEARCH_PLACEHOLDER,
  isSearching = false,
  disabled = false,
  className,
}: AttachmentSearchInputProps) {
  // 清空搜索
  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  return (
    <div className={cn("relative", className)}>
      {/* 搜索图标 / 加载状态 */}
      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        {isSearching ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Search className="size-3.5" />
        )}
      </div>

      {/* 输入框 */}
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "pl-8 pr-8 h-8 rounded-xl text-[10px]",
          "border-pink-100 focus-visible:ring-pink-200",
          "placeholder:text-muted-foreground/60 placeholder:text-[10px]",
        )}
      />

      {/* 清空按钮 */}
      {value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute right-2.5 top-1/2 -translate-y-1/2",
            "text-muted-foreground hover:text-foreground",
            "transition-colors",
          )}
          aria-label="清空搜索"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export default AttachmentSearchInput;
