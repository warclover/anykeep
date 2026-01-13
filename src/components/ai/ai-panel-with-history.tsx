/**
 * AI Panel with Conversation History
 * P1: 带会话历史的 AI 面板
 *
 * 包装 AIPanelContentEnhanced，添加会话历史侧边栏功能
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { History, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AIPanelContentEnhanced } from "./ai-panel-content-enhanced";
import { ConversationList } from "./conversation-list";
import {
  useConversationHistory,
  type ConversationDetail as _ConversationDetail,
} from "@/hooks/domain/ai/use-conversation-history";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import type { DisplayMessage } from "./types";

// =============================================================================
// Types
// =============================================================================

interface AIPanelWithHistoryProps {
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
  /** 初始消息（用于预填输入框） */
  initialMessage?: string;
  /** 是否自动发送初始消息 */
  autoSendInitialMessage?: boolean;
  /** 会话切换回调 */
  onConversationChange?: (conversationId: string | null) => void;
  /** 初始消息列表（用于从历史恢复） */
  initialMessages?: DisplayMessage[];
}

// =============================================================================
// UI Constants
// =============================================================================

const UI_TEXT = {
  historyButton: "历史对话",
  historyTitle: "历史对话",
} as const;

// =============================================================================
// Component
// =============================================================================

export function AIPanelWithHistory({
  conversationId: initialConversationId,
  bookmarkIds,
  folderId,
  title = "AI 知识助手",
  showCloseButton = false,
  onClose,
  className,
  useUnifiedEngine = true,
  initialMessage,
  autoSendInitialMessage = false,
  onConversationChange,
}: AIPanelWithHistoryProps) {
  // 会话历史 Hook
  const { state: historyState, actions: historyActions } =
    useConversationHistory();

  // 本地状态
  const [showHistory, setShowHistory] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(initialConversationId);
  const [restoredMessages, setRestoredMessages] = useState<
    DisplayMessage[] | null
  >(null);

  // 是否启用会话历史功能
  const isHistoryEnabled = FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE;

  /**
   * 处理选择会话
   */
  const handleSelectConversation = useCallback(
    async (id: string) => {
      const detail = await historyActions.select(id);

      if (detail) {
        // 转换消息格式
        const messages: DisplayMessage[] = detail.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          status: "completed" as const,
          createdAt: new Date(m.createdAt),
        }));

        setActiveConversationId(id);
        setRestoredMessages(messages);
        onConversationChange?.(id);
      }

      setShowHistory(false);
    },
    [historyActions, onConversationChange],
  );

  /**
   * 处理新建会话
   */
  const handleNewConversation = useCallback(async () => {
    const newId = await historyActions.create();

    if (newId) {
      setActiveConversationId(newId);
      setRestoredMessages([]); // 清空消息
      onConversationChange?.(newId);
    }

    setShowHistory(false);
  }, [historyActions, onConversationChange]);

  /**
   * 处理删除会话
   */
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      const success = await historyActions.remove(id);

      if (success && activeConversationId === id) {
        // 如果删除的是当前会话，清空
        setActiveConversationId(undefined);
        setRestoredMessages(null);
        onConversationChange?.(null);
      }
    },
    [historyActions, activeConversationId, onConversationChange],
  );

  // P0: 页面加载时恢复会话（从 localStorage 中的 currentId）
  useEffect(() => {
    // 如果已经有活动会话或没有历史会话 ID，跳过
    if (activeConversationId) return;
    const currentId = historyState.currentId;
    if (!currentId) return;
    if (historyState.isLoadingDetail) return;

    // 自动加载历史会话
    const loadHistorySession = async () => {
      const detail = await historyActions.select(currentId);
      if (detail) {
        const messages: DisplayMessage[] = detail.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          status: "completed" as const,
          createdAt: new Date(m.createdAt),
        }));
        setActiveConversationId(currentId);
        setRestoredMessages(messages);
      }
    };

    loadHistorySession();
  }, [
    activeConversationId,
    historyState.currentId,
    historyState.isLoadingDetail,
    historyActions,
  ]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 历史按钮（浮动在面板左上角） */}
      {isHistoryEnabled && (
        <div className="absolute top-1.5 left-2 z-10">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 bg-white/20 hover:bg-white/30 text-white"
                  onClick={() => setShowHistory(true)}
                >
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {UI_TEXT.historyButton}
                {historyState.total > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    ({historyState.total})
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* 主面板内容 */}
      <AIPanelContentEnhanced
        conversationId={activeConversationId}
        bookmarkIds={bookmarkIds}
        folderId={folderId}
        title={title}
        showCloseButton={showCloseButton}
        onClose={onClose}
        useUnifiedEngine={useUnifiedEngine}
        initialMessage={initialMessage}
        autoSendInitialMessage={autoSendInitialMessage}
        initialMessages={restoredMessages ?? undefined}
        // 注入已恢复的消息通过 key 强制重新挂载
        key={restoredMessages ? activeConversationId : "new"}
      />

      {/* 历史会话侧边栏 */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{UI_TEXT.historyTitle}</SheetTitle>
          </SheetHeader>

          <ConversationList
            conversations={historyState.conversations}
            currentId={activeConversationId || null}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
            onClose={() => setShowHistory(false)}
            isLoading={historyState.isLoading}
            hasMore={historyState.hasMore}
            onLoadMore={historyActions.loadMore}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// =============================================================================
// Compact History Toggle Button
// =============================================================================

interface HistoryToggleButtonProps {
  onClick: () => void;
  count?: number;
  className?: string;
}

/**
 * 紧凑版历史按钮（可独立使用）
 */
export function HistoryToggleButton({
  onClick,
  count,
  className,
}: HistoryToggleButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1.5", className)}
            onClick={onClick}
          >
            <History className="h-4 w-4" />
            <span className="text-xs">历史</span>
            {count !== undefined && count > 0 && (
              <span className="text-xs text-muted-foreground">({count})</span>
            )}
            <ChevronRight className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{UI_TEXT.historyButton}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
