/**
 * UI Hooks - UI 状态类
 * 处理用户界面状态和交互反馈
 */

export * from "./use-classification-polling";
export * from "./use-confirmations";
// 注意: 不导出 MessageLevel 以避免与 use-messages.ts 冲突
export {
  useMessageNotification,
  registerGlobalModalHandler,
  unregisterGlobalModalHandler,
  type MessageResult,
  type UseMessageNotificationOptions,
  type UseMessageNotificationResult,
} from "./use-message-notification";
export * from "./use-processing-poller";
export * from "./use-trust-mode";
