/**
 * Conversation List Component
 * P1: 会话历史列表组件
 *
 * 功能：
 * - 显示历史会话列表
 * - 新建对话
 * - 选择/切换会话
 * - 删除会话
 *
 * @version 1.1.0 - 添加 react-virtuoso 虚拟化支持
 * @since 2026-01-13
 */

"use client";

import { useState, useCallback, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Virtuoso } from "react-virtuoso";
import {
  MessageSquare,
  Plus,
  Trash2,
  History,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "@/hooks/domain/ai/use-conversation-history";

// =============================================================================
// Types
// =============================================================================

interface ConversationListProps {
  /** 会话列表 */
  conversations: ConversationListItem[];
  /** 当前选中的会话 ID */
  currentId: string | null;
  /** 选择会话回调 */
  onSelect: (id: string) => void;
  /** 新建会话回调 */
  onNew: () => void;
  /** 删除会话回调 */
  onDelete: (id: string) => void;
  /** 关闭列表回调 */
  onClose?: () => void;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 是否有更多数据 */
  hasMore?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
  /** 自定义 className */
  className?: string;
}

// =============================================================================
// UI Constants
// =============================================================================

const UI_TEXT = {
  newConversation: "新建对话",
  historyTitle: "历史对话",
  loading: "加载中...",
  empty: "暂无历史对话",
  emptyHint: "开始新对话后，会话将保存在这里",
  loadMore: "加载更多",
  delete: "删除会话",
  deleteConfirm: "确定删除此会话？",
} as const;

// 虚拟化配置
const VIRTUOSO_CONFIG = {
  overscan: 100, // 预渲染区域（像素）
  itemHeight: 72, // 预估单项高度
} as const;

// =============================================================================
// Component
// =============================================================================

export function ConversationList({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  className,
}: ConversationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  /**
   * 打开删除确认对话框
   */
  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  }, []);

  /**
   * 确认删除
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmId) return;

    setDeletingId(deleteConfirmId);
    setDeleteConfirmId(null);
    try {
      await onDelete(deleteConfirmId);
    } finally {
      setDeletingId(null);
    }
  }, [deleteConfirmId, onDelete]);

  /**
   * 取消删除
   */
  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  /**
   * 处理加载更多（虚拟列表触底时调用）
   */
  const handleEndReached = useCallback(async () => {
    if (isLoadingMore || !onLoadMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, onLoadMore, hasMore]);

  /**
   * 格式化时间
   */
  const formatTime = useCallback((dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return "";
    }
  }, []);

  /**
   * 渲染单个会话项
   */
  const renderItem = useCallback(
    (index: number) => {
      const conv = conversations[index];
      return (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isSelected={currentId === conv.id}
          isDeleting={deletingId === conv.id}
          onSelect={() => onSelect(conv.id)}
          onDelete={(e) => handleDeleteClick(e, conv.id)}
          formatTime={formatTime}
        />
      );
    },
    [
      conversations,
      currentId,
      deletingId,
      onSelect,
      handleDeleteClick,
      formatTime,
    ],
  );

  /**
   * 渲染列表底部（加载更多状态）
   */
  const renderFooter = useCallback(() => {
    if (!hasMore) return null;

    return (
      <div className="pt-2 pb-1 px-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={handleEndReached}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          {UI_TEXT.loadMore}
        </Button>
      </div>
    );
  }, [hasMore, isLoadingMore, handleEndReached]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{UI_TEXT.historyTitle}</span>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New Conversation Button */}
      <div className="p-2 border-b">
        <Button
          onClick={onNew}
          className="w-full justify-start gap-2"
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {UI_TEXT.newConversation}
        </Button>
      </div>

      {/* Conversation List - Virtualized */}
      <div className="flex-1 overflow-hidden">
        {isLoading && conversations.length === 0 ? (
          // 初始加载状态
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-sm">{UI_TEXT.loading}</span>
          </div>
        ) : conversations.length === 0 ? (
          // 空状态
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm">{UI_TEXT.empty}</span>
            <span className="text-xs mt-1 opacity-70">{UI_TEXT.emptyHint}</span>
          </div>
        ) : (
          // 虚拟化会话列表
          <Virtuoso
            data={conversations}
            overscan={VIRTUOSO_CONFIG.overscan}
            itemContent={(index) => renderItem(index)}
            endReached={handleEndReached}
            components={{
              Footer: renderFooter,
            }}
            className="p-2"
            style={{ height: "100%" }}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && handleDeleteCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{UI_TEXT.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {UI_TEXT.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Sub-component: ConversationItem (Memoized)
// =============================================================================

interface ConversationItemProps {
  conversation: ConversationListItem;
  isSelected: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatTime: (dateString: string) => string;
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  isDeleting,
  onSelect,
  onDelete,
  formatTime,
}: ConversationItemProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-start gap-2 p-2 rounded-md cursor-pointer mb-1",
        "hover:bg-accent transition-colors",
        isSelected && "bg-accent",
        isDeleting && "opacity-50 pointer-events-none",
      )}
    >
      {/* Icon */}
      <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <div className="text-sm font-medium truncate">{conversation.title}</div>

        {/* Last message preview */}
        {conversation.lastMessage && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {conversation.lastMessage}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatTime(conversation.updatedAt)}
          </span>
          {conversation.messageCount > 0 && (
            <span className="text-xs text-muted-foreground/70">
              · {conversation.messageCount} 条消息
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 shrink-0",
                "opacity-0 group-hover:opacity-100",
                "transition-opacity",
              )}
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {UI_TEXT.delete}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
});

// =============================================================================
// Compact variant for sidebar integration
// =============================================================================

interface ConversationListCompactProps
  extends Omit<ConversationListProps, "className"> {
  /** 是否展开 */
  expanded: boolean;
  /** 切换展开状态 */
  onToggle: () => void;
}

/**
 * 紧凑版会话列表（用于侧边栏集成）
 */
export function ConversationListCompact({
  expanded,
  onToggle,
  ...props
}: ConversationListCompactProps) {
  if (!expanded) {
    // 收起状态：只显示历史按钮
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggle}>
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{UI_TEXT.historyTitle}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 展开状态：显示完整列表
  return (
    <ConversationList {...props} onClose={onToggle} className="w-64 border-r" />
  );
}
