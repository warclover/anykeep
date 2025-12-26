/**
 * AI 助手面板组件
 *
 * 提供与 AI 助手对话的完整界面（Sheet 覆盖模式）
 * 通过 API 路由与后端 Agent 交互
 *
 * @version 2.0.0
 * @since 2025-12-22
 * @updated 2025-12-23 - 重构为使用 AIPanelContent 组件
 */

"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AIPanelContentEnhanced } from "./ai-panel-content-enhanced";
import type { AIAssistantPanelProps } from "./types";

/**
 * AI 助手面板组件（Sheet 覆盖模式）
 */
export function AIAssistantPanel({
  open,
  onOpenChange,
  // userId 由 API 层从 session 获取，此处不直接使用
  userId: _userId,
  conversationId,
  bookmarkIds,
  title = "AI 知识助手",
  // description 用于未来扩展，暂不使用
  description: _description = "我可以帮你搜索、分类和整理你的收藏内容",
}: AIAssistantPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-md p-0"
      >
        {/* 隐藏的标题和描述（用于无障碍访问） */}
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>AI 助手对话面板</SheetDescription>
        </SheetHeader>

        {/* 面板内容 */}
        <AIPanelContentEnhanced
          conversationId={conversationId}
          bookmarkIds={bookmarkIds}
          title={title}
          showCloseButton={false}
        />
      </SheetContent>
    </Sheet>
  );
}
