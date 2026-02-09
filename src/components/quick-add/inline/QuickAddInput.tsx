"use client";

/**
 * Quick Add Input Component
 *
 * The idle/focused state input field for quick bookmark adding.
 * Supports auto-paste from clipboard on focus.
 */

import { forwardRef, useCallback, useEffect, useRef } from "react";
import { Link2, FolderHeart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClipboardPaste, isValidUrl } from "../hooks/useClipboardPaste";
import type { QuickAddMode } from "../hooks/useQuickAddState";

export interface QuickAddInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onUrlDetected: (url: string) => void;
  mode: QuickAddMode;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** URL that was just successfully processed - will be skipped on next auto-paste */
  lastProcessedUrl?: string | null;
}

export const QuickAddInput = forwardRef<HTMLInputElement, QuickAddInputProps>(
  (
    {
      value,
      onChange,
      onFocus,
      onBlur,
      onUrlDetected,
      mode,
      placeholder = "粘贴链接，一秒收藏",
      className,
      disabled = false,
      lastProcessedUrl,
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const hasAutoRead = useRef(false);

    // Merge refs
    const setRef = useCallback(
      (node: HTMLInputElement | null) => {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current =
          node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLInputElement | null>).current =
            node;
        }
      },
      [ref],
    );

    // Clipboard paste hook
    const { readClipboard, extractUrlFromText, markUrlAsProcessed } =
      useClipboardPaste({
        onUrlExtracted: (url) => {
          onChange(url);
          onUrlDetected(url);
        },
      });

    // Mark URL as processed when lastProcessedUrl changes
    useEffect(() => {
      if (lastProcessedUrl) {
        markUrlAsProcessed(lastProcessedUrl);
      }
    }, [lastProcessedUrl, markUrlAsProcessed]);

    // Auto-paste on focus
    const handleFocus = useCallback(async () => {
      onFocus();

      // Only auto-read once per focus session
      if (!hasAutoRead.current && mode === "idle") {
        hasAutoRead.current = true;
        await readClipboard();
      }
    }, [onFocus, readClipboard, mode]);

    // Reset auto-read flag on blur
    const handleBlur = useCallback(() => {
      hasAutoRead.current = false;
      onBlur();
    }, [onBlur]);

    // Handle input change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        // Check if value contains a URL
        const url = extractUrlFromText(newValue);
        if (url && isValidUrl(url)) {
          onUrlDetected(url);
        }
      },
      [onChange, extractUrlFromText, onUrlDetected],
    );

    // Handle paste event
    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData("text");
        const url = extractUrlFromText(pastedText);

        if (url && isValidUrl(url)) {
          e.preventDefault();
          onChange(url);
          onUrlDetected(url);
        }
      },
      [extractUrlFromText, onChange, onUrlDetected],
    );

    // Focus input on mount if mode is focused
    useEffect(() => {
      if (mode === "focused" && inputRef.current) {
        inputRef.current.focus();
      }
    }, [mode]);

    const isIdle = mode === "idle";
    const isLoading = mode === "loading";
    const isFocused = mode === "focused";

    return (
      <div
        className={cn(
          // Base styles
          "relative flex items-center gap-2 w-full h-8 px-3",
          "rounded-full border-2 transition-all duration-200",

          // Idle state - 糖果粉色虚线边框和渐变背景
          isIdle && [
            "border-dashed border-pink-300",
            "bg-gradient-to-r from-pink-100/80 via-rose-50/40 to-purple-100/60",
            "shadow-sm shadow-pink-200",
            "hover:border-pink-400 hover:shadow-md hover:shadow-pink-300/50",
            "hover:bg-gradient-to-r hover:from-pink-200/70 hover:via-rose-100/50 hover:to-purple-200/60",
            "cursor-text",
          ],

          // Focused state - solid border, white background
          (isFocused || isLoading) && [
            "border-solid border-purple-500",
            "bg-white",
            "shadow-[0_0_0_4px_rgba(139,92,246,0.15)]",
            "scale-[1.02]",
          ],

          // Disabled state
          disabled && "opacity-50 cursor-not-allowed",

          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 transition-colors duration-200",
            isIdle && "text-pink-400",
            (isFocused || isLoading) && "text-pink-500",
          )}
        >
          {isLoading ? (
            <FolderHeart className="w-4 h-4 animate-absorb-target-pulse" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
        </div>

        {/* Input */}
        <input
          ref={setRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(
            "flex-1 bg-transparent border-none outline-none",
            "text-sm font-medium placeholder:text-purple-400/80 placeholder:font-normal",
            "disabled:cursor-not-allowed",
          )}
        />

        {/* Loading indicator - 与收藏按钮保持一致的形态 */}
        {isLoading && (
          <span
            className={cn(
              "flex items-center gap-1.5 h-7 px-3 rounded-full",
              "text-xs font-medium text-pink-500",
              "animate-absorb-target-pulse",
            )}
          >
            <FolderHeart className="w-4 h-4" />
            获取中
          </span>
        )}
      </div>
    );
  },
);

QuickAddInput.displayName = "QuickAddInput";
