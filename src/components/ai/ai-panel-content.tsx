/**
 * AI 面板内容组件
 *
 * 提取的面板核心内容，支持在 Sheet（覆盖式）和 embedded（内嵌式）模式下复用
 * 支持统一智能引擎（原子模式 + 编排模式）
 *
 * ## 版本历史
 * - v2.2.0 (2026-03-06): 拆分为 hooks + 子组件，降低文件行数
 * - v2.1.0 (2025-12-24): 集成 Effect Layer 统一确认处理
 * - v2.0.0 (2025-12-24): 集成统一智能引擎
 *
 * @version 2.2.0
 * @since 2025-12-23
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, Trash2, RotateCcw, X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIMessage } from "./ai-message";
import { AIInput } from "./ai-input";
import { ActionConfirmInline } from "./action-confirm-dialog";
import { PanelWelcome, PanelSuggestionBar } from "./panel-welcome";
import { usePanelMessages } from "./hooks/use-panel-messages";
import { usePanelConfirmation } from "./hooks/use-panel-confirmation";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";

interface AIPanelContentProps {
  /** 对话 ID（可选，用于继续对话） */
  conversationId?: string;
  /** 关联的书签 ID 列表（可选） */
  bookmarkIds?: number[];
  /** 关联的文件夹 ID（可选） */
  folderId?: number;
  /** 面板标题 */
  title?: string;
  /** 是否显示关闭按钮 */
  showCloseButton?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义 className */
  className?: string;
  /** 是否使用统一引擎（默认 true） */
  useUnifiedEngine?: boolean;
}

/**
 * AI 面板内容组件
 */
export function AIPanelContent({
  conversationId: initialConversationId,
  bookmarkIds,
  folderId,
  title = "AI 知识助手",
  showCloseButton = false,
  onClose,
  className,
  useUnifiedEngine = true,
}: AIPanelContentProps) {
  // 记忆提示状态（显示"AI 记住了"）
  const [showMemoryHint, setShowMemoryHint] = useState(false);

  // 使用 ref 解决循环依赖：messages hook 通过 ref 回调添加 confirmation
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- ref initialized with noop, bound in useEffect below
  const addConfirmationRef = useRef<(c: PendingConfirmation) => void>(() => {});

  // 记忆提示回调
  const handleMemory = useCallback(() => {
    setShowMemoryHint(true);
    setTimeout(() => setShowMemoryHint(false), 3000);
  }, []);

  // stable callback via ref
  const onConfirmation = useCallback((c: PendingConfirmation) => {
    addConfirmationRef.current(c);
  }, []);

  // 消息管理 hook（先声明，因为 confirmation hook 需要 setMessages）
  const {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    scrollRef,
    handleSubmit,
    handleClear: clearMessages,
    handleRetry,
    handleSuggestionClick,
  } = usePanelMessages({
    initialConversationId,
    bookmarkIds,
    folderId,
    useUnifiedEngine,
    onConfirmation,
    onMemory: handleMemory,
  });

  // 确认操作 hook（使用真正的 setMessages）
  const {
    pendingConfirmations,
    setPendingConfirmations,
    isConfirming,
    addConfirmation,
    handleConfirm,
    handleCancel,
  } = usePanelConfirmation({ setMessages });

  // 绑定 ref
  useEffect(() => {
    addConfirmationRef.current = addConfirmation;
  }, [addConfirmation]);

  // 清除对话时同时清除 pendingConfirmations
  const handleClear = useCallback(() => {
    clearMessages();
    setPendingConfirmations([]);
  }, [clearMessages, setPendingConfirmations]);

  // 滚动同步：pendingConfirmations 变化时触发滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pendingConfirmations, scrollRef]);

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      {/* 头部 - 糖果色渐变背景（紧凑版） */}
      <div className="relative px-3 py-1.5 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* AI 头像带光环动画 */}
            <div className="relative">
              <div
                className="absolute inset-0 bg-white/30 rounded-full animate-ping opacity-75"
                style={{ animationDuration: "2s" }}
              />
              <div className="relative w-7 h-7 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/40 shadow-md">
                <Sparkles className="size-3.5 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-white">{title}</h3>
              <span className="text-[10px] text-white/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                在线
                {/* 记忆提示 */}
                {showMemoryHint && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-white/90 flex items-center gap-0.5 animate-fade-in">
                    <Brain className="size-2.5" />
                    记住了
                  </span>
                )}
              </span>
            </div>
          </div>
          {/* 右侧按钮区域 */}
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClear}
                title="清除对话"
                className="text-white/80 hover:text-white hover:bg-white/20"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            {showCloseButton && onClose && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                title="关闭"
                className="text-white/80 hover:text-white hover:bg-white/20"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-pink-50/50 to-white"
      >
        <div className="pr-3">
          {messages.length === 0 ? (
            <PanelWelcome inputValue={input} onSetInput={setInput} />
          ) : (
            <div className="py-2">
              {messages.map((message, index) => (
                <div key={message.id}>
                  <AIMessage
                    message={message}
                    isLast={index === messages.length - 1}
                    onSuggestionClick={handleSuggestionClick}
                  />

                  {/* 显示待确认操作 */}
                  {message.pendingConfirmations &&
                    message.pendingConfirmations.length > 0 && (
                      <div className="px-4 py-2 space-y-2">
                        {message.pendingConfirmations.map((confirmation) => (
                          <ActionConfirmInline
                            key={confirmation.confirmationId}
                            confirmation={confirmation}
                            onConfirm={handleConfirm}
                            onCancel={handleCancel}
                            isLoading={isConfirming}
                          />
                        ))}
                      </div>
                    )}
                </div>
              ))}

              {/* 重试按钮 */}
              {messages[messages.length - 1]?.status === "error" && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="gap-1"
                  >
                    <RotateCcw className="size-3" />
                    重试
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 快捷建议栏 - 有消息时显示 */}
      {messages.length > 0 && !isLoading && (
        <PanelSuggestionBar onSetInput={setInput} />
      )}

      {/* 输入区域 */}
      <AIInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isLoading}
        placeholder="输入消息..."
      />
    </div>
  );
}
