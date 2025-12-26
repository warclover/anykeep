/**
 * AI Memory 模块入口
 *
 * 提供会话状态管理和指代解析功能
 *
 * @version 1.1.0
 * @since 2025-12-25
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
