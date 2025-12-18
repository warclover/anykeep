/**
 * Message Feature Module
 *
 * Phase 5: 模块解耦
 * 消息功能模块统一入口
 *
 * 模块边界契约：
 * - 公共组件通过 components 导出
 * - 公共 Hooks 通过 hooks 导出
 * - 公共类型通过 types 导出
 *
 * 使用示例：
 * ```typescript
 * import { MessageList, useMessages } from "@/features/message";
 * ```
 */

// ============================================================================
// Components - 公共组件
// ============================================================================

// 从现有组件目录重导出
export {
  MessageItem,
  MessageList,
  MessageGroupHeader,
  MessageEmptyState,
  MessageFilter,
  MessageBadge,
  MessageModal,
  MessagesPageClient,
  NotificationSettingsCard,
  MessageNotificationProvider,
} from "@/components/messages";

// 类型重导出
export type {
  MessageItemProps,
  MessageListProps,
  MessageGroupHeaderProps,
  MessageEmptyStateProps,
  EmptyStateVariant,
  MessageFilterProps,
  MessageBadgeProps,
  MessageModalProps,
  MessageNotificationProviderProps,
} from "@/components/messages";

// 确认消息相关组件
export { ConfirmationMessageItem } from "@/components/messages/confirmation-message-item";
export { FolderSelectorDialog } from "@/components/messages/folder-selector-dialog";
export { PendingConfirmationFilter } from "@/components/messages/pending-confirmation-filter";

// ============================================================================
// Hooks - 公共 Hooks
// ============================================================================

export { useMessages } from "@/hooks/data/use-messages";
export { useUnreadCount } from "@/hooks/data/use-unread-count";
export { useMessageNotification } from "@/hooks/ui/use-message-notification";
export { useConfirmations } from "@/hooks/ui/use-confirmations";

// ============================================================================
// Services - 内部服务（通过 lib 导出）
// ============================================================================

export { MessageDispatcher } from "@/lib/messages/message-dispatcher";

export { MessageService } from "@/lib/messages/message-service";

// ============================================================================
// Types - 公共类型
// ============================================================================

export type { Message, MessageType, MessageLevel } from "@/lib/messages/types";
