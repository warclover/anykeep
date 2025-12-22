/**
 * AI 输入框组件
 *
 * 用于输入发送给 AI 助手的消息
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useRef, useCallback, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AIInputProps } from "./types";

/**
 * AI 输入框组件
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
    <div className="flex items-end gap-2 p-4 border-t bg-background">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "min-h-[40px] max-h-[120px] resize-none",
          "focus-visible:ring-1 focus-visible:ring-primary",
        )}
        style={{
          height: "auto",
          overflow: "hidden",
        }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = "auto";
          target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
        }}
      />
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0"
      >
        {disabled ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
      </Button>
    </div>
  );
}
