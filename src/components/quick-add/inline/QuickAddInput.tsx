"use client";

/**
 * Quick Add Input Component
 *
 * The idle/focused state input field for quick bookmark adding.
 * Supports auto-paste from clipboard on focus.
 */

import { forwardRef, useCallback, useEffect, useRef } from "react";
import { Link2, Loader2 } from "lucide-react";
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
    const { readClipboard, extractUrlFromText } = useClipboardPaste({
      onUrlExtracted: (url) => {
        onChange(url);
        onUrlDetected(url);
      },
    });

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
          "relative flex items-center gap-3 w-full h-12 px-5",
          "rounded-full border-2 transition-all duration-200",

          // Idle state - 醒目的虚线边框和渐变背景
          isIdle && [
            "border-dashed border-purple-400",
            "bg-gradient-to-r from-purple-50 via-white to-blue-50",
            "shadow-sm shadow-purple-100",
            "hover:border-purple-500 hover:shadow-md hover:shadow-purple-200/50",
            "hover:bg-gradient-to-r hover:from-purple-100/50 hover:via-white hover:to-blue-100/50",
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
            isIdle && "text-purple-500",
            (isFocused || isLoading) && "text-purple-600",
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Link2 className="w-5 h-5" />
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

        {/* Loading indicator text */}
        {isLoading && (
          <span className="text-xs text-purple-500 animate-pulse">
            获取中...
          </span>
        )}
      </div>
    );
  },
);

QuickAddInput.displayName = "QuickAddInput";
