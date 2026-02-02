/**
 * 消息系统 - 服务端专用模块
 * @description 仅在服务端（Server Components、API Routes、Server Actions）中使用
 *
 * @version 2.0.0 - 2026-02-02 迁移到 MessageFacade，底层使用新的 NotificationService
 */

// 导出新的统一 Facade（推荐使用）
export { MessageFacade } from "./message-facade";

// 保留旧名称别名以保持向后兼容（逐步废弃）
export { MessageFacade as MessageService } from "./message-facade";

// 类型导出
export type { MessageType, MessageResult, CreateMessageParams } from "./types";
