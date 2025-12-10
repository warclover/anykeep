/**
 * 消息系统模块
 * @description 导出消息系统的所有公共 API
 */

// 类型导出
export type {
  MessageType,
  MessageLevel,
  MessageStatus,
  DateGroup,
  Message,
  MessageWithGroup,
  MessageGroup,
  UnreadCounts,
  CreateMessageParams,
  MessageResult,
  NotificationPreferences,
  GetMessagesParams,
  GetMessagesResponse,
} from "./types";

// 分级系统
export {
  MESSAGE_LEVEL_CONFIG,
  MESSAGE_TYPE_LEVELS,
  MESSAGE_VISUAL_STYLES,
  getMessageLevel,
  getLevelConfig,
  getVisualStyle,
  shouldShowToast,
  shouldShowModal,
  getDefaultPriority,
} from "./message-levels";
export type { LevelConfig, VisualStyle } from "./message-levels";

// 消息模板
export {
  MESSAGE_TEMPLATES,
  getMessageTemplate,
  renderMessage,
} from "./message-templates";
export type { MessageTemplate } from "./message-templates";

// 消息服务 - 仅限服务端使用
// 从 '@/lib/messages/server' 导入 MessageService

// 消息分发器（前端使用）- 已废弃，推荐使用 useMessageNotification
export {
  MessageDispatcher,
  useMessageModalHandler,
} from "./message-dispatcher";
export type { DispatchMessage } from "./message-dispatcher";

// 消息通知 Hook（前端推荐使用）
export {
  useMessageNotification,
  registerGlobalModalHandler,
  unregisterGlobalModalHandler,
} from "@/hooks/use-message-notification";
export type {
  UseMessageNotificationOptions,
  UseMessageNotificationResult,
} from "@/hooks/use-message-notification";
