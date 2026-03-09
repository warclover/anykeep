/**
 * AI Memory 模块入口
 *
 * 提供会话状态管理和指代解析功能
 *
 * @version 1.3.0
 * @since 2025-12-25
 * @updated 2025-12-27 - 添加压缩摘要持久化
 * @updated 2025-12-30 - 添加跨会话记忆服务 (Phase 1)
 */

// 类型导出
export * from "./types";

// SessionMemory 导出
export {
  SessionMemory,
  createSessionMemory,
  sessionMemory,
} from "./session-memory";

// ReferenceResolver 导出
export {
  ReferenceResolver,
  createReferenceResolver,
  referenceResolver,
} from "./reference-resolver";

// MemoryManager 导出
export {
  MemoryManager,
  createMemoryManager,
  memoryManager,
  type MemoryManagerConfig,
} from "./memory-manager";

// MemoryPersistence 导出
export {
  MemoryPersistence,
  createMemoryPersistence,
  memoryPersistence,
  type SessionMemoryRecord,
  type SaveStateParams,
  type LoadStateParams,
  type PersistenceResult,
  type ActiveSessionInfo,
} from "./persistence";

// PersistentSessionMemory 导出
export {
  PersistentSessionMemory,
  createPersistentSessionMemory,
  persistentSessionMemory,
  type PersistentSessionMemoryConfig,
} from "./persistent-session-memory";

// CompressionSummaryPersistence 导出（v1.2 新增）
export {
  CompressionSummaryPersistence,
  compressionSummaryPersistence,
  createCompressionSummaryPersistence,
  type SaveCompressionSummaryParams,
  type CompressionPersistenceResult,
} from "./compression-summary-persistence";

// CrossSessionMemoryService 导出（v1.3 新增 - Phase 1）
export {
  CrossSessionMemoryService,
  createCrossSessionMemoryService,
} from "./cross-session-memory-service";

// SessionSummarizer 导出（v1.4 新增 - P2 LLM 摘要）
export {
  generateSessionSummary,
  generateSimpleSummary,
  generateSessionSummaryWithFallback,
  SessionSummarySchema,
  type SessionSummary,
  type SessionMessage,
  type SessionSummarizerConfig,
} from "./session-summarizer";

// ConversationAttachmentTracker 导出（v1.5 新增 - 附件追踪）
export {
  conversationAttachmentTracker,
  type ConversationAttachment,
  type ConversationAttachmentStore,
  type AttachmentInput,
} from "./conversation-attachments";
