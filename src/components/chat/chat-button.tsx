/**
 * AI 对话悬浮按钮
 * Phase 4.3: 全局入口，点击打开对话面板
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatPanel } from "./chat-panel";
import { cn } from "@/lib/utils";

interface ChatButtonProps {
  /** 自定义类名 */
  className?: string;
  /** 限制到特定文件夹 */
  folderId?: number;
}

/**
 * AI 对话悬浮按钮
 */
export function ChatButton({ className, folderId }: ChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 悬浮按钮 */}
      <Button
        size="lg"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "rounded-full shadow-lg",
          "bg-purple-600 hover:bg-purple-700",
          "h-14 w-14 p-0",
          "transition-transform hover:scale-105",
          className
        )}
      >
        <MessageSquareText className="size-6" />
        <span className="sr-only">打开 AI 助手</span>
      </Button>

      {/* 对话面板 Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>AI 助手</SheetTitle>
          </SheetHeader>
          <ChatPanel
            folderId={folderId}
            showClose
            onClose={() => setIsOpen(false)}
            className="border-0 rounded-none h-full"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * 内联对话触发器（用于书签详情页等场景）
 */
export function ChatTrigger({
  bookmarkId,
  children,
  className,
}: {
  bookmarkId: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn("gap-2", className)}
      >
        <MessageSquareText className="size-4" />
        {children || "与 AI 对话"}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>AI 助手</SheetTitle>
          </SheetHeader>
          <ChatPanel
            bookmarkIds={[bookmarkId]}
            showClose
            onClose={() => setIsOpen(false)}
            className="border-0 rounded-none h-full"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
