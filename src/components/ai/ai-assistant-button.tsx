/**
 * AI 助手按钮组件
 *
 * 悬浮按钮，点击打开 AI 助手面板
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useCallback } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIAssistantPanel } from "./ai-assistant-panel";
import type { AIAssistantButtonProps } from "./types";

/**
 * AI 助手按钮组件
 */
export function AIAssistantButton({
  userId,
  bookmarkIds,
  className,
  size = "default",
  variant = "default",
}: AIAssistantButtonProps) {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  // 按钮尺寸映射
  const sizeMap = {
    sm: "icon-sm",
    default: "icon",
    lg: "icon-lg",
  } as const;

  return (
    <>
      <Button
        variant={variant}
        size={sizeMap[size]}
        onClick={handleOpen}
        className={cn("rounded-full shadow-lg", className)}
        title="AI 助手"
      >
        <Bot
          className={cn(
            size === "sm" && "size-4",
            size === "default" && "size-5",
            size === "lg" && "size-6",
          )}
        />
      </Button>

      <AIAssistantPanel
        open={open}
        onOpenChange={handleOpenChange}
        userId={userId}
        bookmarkIds={bookmarkIds}
      />
    </>
  );
}

/**
 * 悬浮 AI 助手按钮（固定在右下角）
 */
export function FloatingAIAssistantButton({
  userId,
  bookmarkIds,
  className,
}: Omit<AIAssistantButtonProps, "size" | "variant">) {
  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      <AIAssistantButton
        userId={userId}
        bookmarkIds={bookmarkIds}
        size="lg"
        variant="default"
        className="shadow-xl hover:shadow-2xl transition-shadow"
      />
    </div>
  );
}
