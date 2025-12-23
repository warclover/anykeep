/**
 * AI 输入框组件
 *
 * 用于输入发送给 AI 助手的消息
 * 糖果色风格设计
 *
 * @version 1.1.0
 * @since 2025-12-22
 */

"use client";

import { useRef, useCallback, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AIInputProps } from "./types";

/**
 * AI 输入框组件 - 糖果色风格
 */
export function AIInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "输入消息...",
}: AIInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送（Shift+Enter 换行）
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) {
          onSubmit();
        }
      }
    },
    [value, disabled, onSubmit],
  );

  // 处理提交
  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      onSubmit();
    }
  }, [value, disabled, onSubmit]);

  return (
    <div className="p-4 border-t border-pink-100 bg-gradient-to-t from-pink-50/30 to-white">
      <div className="flex items-end gap-3">
        {/* 输入框容器 - 糖果色风格 */}
        <div
          className={cn(
            "flex-1 bg-white rounded-2xl px-4 py-3 transition-all duration-200",
            "border-2 border-pink-100",
            "focus-within:border-pink-300 focus-within:shadow-[0_0_0_3px_rgba(244,114,182,0.15)]",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full bg-transparent resize-none outline-none text-gray-700 placeholder-gray-400 text-sm",
              "min-h-[24px] max-h-[100px] border-0 p-0 focus-visible:ring-0",
            )}
            style={{
              height: "auto",
              overflow: "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
            }}
          />
        </div>

        {/* 发送按钮 - 糖果色风格 */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
            "bg-gradient-to-r from-pink-400 to-rose-400 text-white",
            "shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:scale-105",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none",
          )}
        >
          {disabled ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Send className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
}
