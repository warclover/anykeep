/**
 * 统一输出层模块导出
 *
 * @module ai-skills/output
 * @version 1.0.0
 * @since 2025-12-24
 */

// 类型导出
export type {
  // 基础类型
  DeliverableType,
  OutputFormat,
  ConfirmOption,
  Suggestion,
  DeliverableAction,
  // 输出块类型
  TextChunk,
  ProgressChunk,
  ToolCallChunk,
  ConfirmationChunk,
  ConfirmationResponse,
  DeliverableChunk,
  SuggestionsChunk,
  RoutingChunk,
  ErrorChunk,
  FallbackChunk,
  DoneChunk,
  // 统一类型
  UnifiedStreamChunk,
  OrchestrationStreamChunk,
  // 辅助类型
  ChunkTypeMap,
  ChunkData,
} from "./types";

// 输出适配器
export {
  UnifiedOutputAdapter,
  createUnifiedOutputAdapter,
  unifiedOutputAdapter,
} from "./adapter";

// 格式化器
export * from "./formatters";
